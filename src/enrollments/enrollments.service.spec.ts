import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { Enrollment } from './enrollment.entity';
import { PaymentMethod } from './enrollment.enums';
import { EnrollmentsService } from './enrollments.service';
import { Payment } from './payment.entity';

// Unit-test double only, not an application entity or a database rollback proof.
jest.mock('../courses/course.entity', () => ({ Course: class Course {} }), {
  virtual: true,
});

describe('EnrollmentsService', () => {
  const dto = { courseId: 1, method: PaymentMethod.BKASH };
  let service: EnrollmentsService;
  let course: { id: number; availableSeats: number; price: number };
  let enrollment: Enrollment;
  let manager: {
    findOne: jest.Mock;
    existsBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let repo: { findOne: jest.Mock; find: jest.Mock; findAndCount: jest.Mock };
  let transaction: jest.Mock;
  let committed: boolean;

  beforeEach(() => {
    course = { id: 1, availableSeats: 2, price: 1500 };
    enrollment = Object.assign(new Enrollment(), { id: 20, course });
    committed = false;
    manager = {
      findOne: jest.fn().mockResolvedValue(course),
      existsBy: jest.fn().mockResolvedValue(false),
      create: jest.fn((entity: new () => object, data: object) =>
        Object.assign(new entity(), data),
      ),
      save: jest.fn(async (entity: object) => {
        if (entity instanceof Enrollment) return enrollment;
        return entity;
      }),
    };
    transaction = jest.fn(
      async (work: (manager: EntityManager) => Promise<number>) => {
        const id = await work(manager as unknown as EntityManager);
        committed = true;
        return id;
      },
    );
    repo = {
      findOne: jest.fn().mockResolvedValue(enrollment),
      find: jest.fn().mockResolvedValue([enrollment]),
      findAndCount: jest.fn().mockResolvedValue([[enrollment], 21]),
    };
    service = new EnrollmentsService(
      { transaction } as unknown as DataSource,
      repo as unknown as Repository<Enrollment>,
    );
  });

  it('locks the course, writes all three tables with the manager, then reloads', async () => {
    repo.findOne.mockImplementation(async () => {
      expect(committed).toBe(true);
      return enrollment;
    });
    expect(await service.enroll(7, dto)).toBe(enrollment);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(manager.findOne).toHaveBeenCalledWith(expect.any(Function), {
      where: { id: 1 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.existsBy).toHaveBeenCalledWith(Enrollment, {
      student: { id: 7 },
      course: { id: 1 },
    });
    expect(manager.create).toHaveBeenNthCalledWith(1, Enrollment, {
      student: { id: 7 },
      course: { id: 1 },
    });
    expect(manager.create).toHaveBeenNthCalledWith(2, Payment, {
      enrollment: { id: 20 },
      amount: 1500,
      method: PaymentMethod.BKASH,
      status: 'paid',
    });
    expect(manager.save).toHaveBeenNthCalledWith(1, expect.any(Enrollment));
    expect(manager.save).toHaveBeenNthCalledWith(2, expect.any(Payment));
    expect(manager.save).toHaveBeenNthCalledWith(3, course);
    expect(course.availableSeats).toBe(1);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 20 },
      relations: { course: true, payment: true, student: true },
    });
  });

  it('returns 404 without writing when the course is missing', async () => {
    manager.findOne.mockResolvedValue(null);
    await expect(service.enroll(7, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.save).not.toHaveBeenCalled();
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(committed).toBe(false);
  });

  it.each([0, -1])('rejects a course with %i seats without writing', async (seats) => {
    course.availableSeats = seats;
    await expect(service.enroll(7, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.save).not.toHaveBeenCalled();
    expect(committed).toBe(false);
  });

  it('rejects duplicate enrollment with 409 without writing', async () => {
    manager.existsBy.mockResolvedValue(true);
    await expect(service.enroll(7, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
    expect(committed).toBe(false);
  });

  it('throws inside the transaction AFTER all three writes for the rollback demo', async () => {
    await expect(
      service.enroll(7, { ...dto, simulateFailure: true }),
    ).rejects.toEqual(
      new InternalServerErrorException(
        'Simulated payment failure: transaction rolled back',
      ),
    );
    expect(manager.save).toHaveBeenCalledTimes(3);
    expect(committed).toBe(false);
    expect(repo.findOne).not.toHaveBeenCalled();
    // Real PostgreSQL rollback is verified separately by the SQL/Postman demo.
  });

  it.each([1, 2, 3])('propagates a failure at write %i out of the transaction', async (write) => {
    const error = new Error('Database write failed');
    manager.save.mockReset();
    for (let index = 1; index < write; index += 1) {
      manager.save.mockResolvedValueOnce(enrollment);
    }
    manager.save.mockRejectedValueOnce(error);
    await expect(service.enroll(7, dto)).rejects.toBe(error);
    expect(manager.save).toHaveBeenCalledTimes(write);
    expect(committed).toBe(false);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing enrollment', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(
      'Enrollment with id 999 not found',
    );
  });

  it('scopes the student list to the authenticated user', async () => {
    expect(await service.findMy(7)).toEqual([enrollment]);
    expect(repo.find).toHaveBeenCalledWith({
      where: { student: { id: 7 } },
      relations: { course: true, payment: true },
      order: { enrolledAt: 'DESC' },
    });
  });

  it('paginates the admin list with deterministic order and metadata', async () => {
    expect(await service.findAll({ page: 2, limit: 10 })).toEqual({
      data: [enrollment],
      meta: { total: 21, page: 2, limit: 10, totalPages: 3 },
    });
    expect(repo.findAndCount).toHaveBeenCalledWith({
      relations: { student: true, course: true, payment: true },
      order: { id: 'ASC' },
      skip: 10,
      take: 10,
    });
  });

  it('returns zero total pages for an empty result', async () => {
    repo.findAndCount.mockResolvedValue([[], 0]);
    expect(await service.findAll({ page: 1, limit: 10 })).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
  });
});
