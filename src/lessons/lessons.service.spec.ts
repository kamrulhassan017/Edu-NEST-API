import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { Lesson } from './lesson.entity';
import { LessonsService } from './lessons.service';

// Unit-test doubles only: Rupam's Course module is not in this branch yet.
// These do not supply or replace the application's missing Course module.
jest.mock('../courses/course.entity', () => ({ Course: class Course {} }), {
  virtual: true,
});
jest.mock(
  '../courses/courses.service',
  () => ({ CoursesService: class CoursesService {} }),
  { virtual: true },
);

describe('LessonsService', () => {
  const user = { sub: 7, email: 'teacher@test.com', role: Role.INSTRUCTOR };
  let service: LessonsService;
  let lesson: Lesson;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let courses: { findOne: jest.Mock; checkOwner: jest.Mock };

  beforeEach(() => {
    const course = { id: 1, instructor: { id: user.sub } };
    lesson = Object.assign(new Lesson(), {
      id: 4,
      title: 'Intro to NestJS',
      content: 'Modules, controllers, services',
      position: 1,
      course,
    });
    repo = {
      create: jest.fn((data: object) => Object.assign(new Lesson(), data)),
      save: jest.fn().mockResolvedValue(lesson),
      find: jest.fn().mockResolvedValue([lesson]),
      findOne: jest.fn().mockResolvedValue(lesson),
      remove: jest.fn().mockResolvedValue(lesson),
    };
    courses = {
      findOne: jest.fn().mockResolvedValue(course),
      checkOwner: jest.fn(),
    };
    service = new LessonsService(
      repo as unknown as Repository<Lesson>,
      courses as unknown as ConstructorParameters<typeof LessonsService>[1],
    );
  });

  it('checks ownership and defaults a new lesson to position 1', async () => {
    const result = await service.create(
      { courseId: 1, title: lesson.title, content: lesson.content },
      user,
    );
    expect(courses.findOne).toHaveBeenCalledWith(1);
    expect(courses.checkOwner).toHaveBeenCalledWith(lesson.course, user);
    expect(repo.create).toHaveBeenCalledWith({
      title: lesson.title,
      content: lesson.content,
      position: 1,
      course: { id: 1 },
    });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 4 },
      relations: { course: { instructor: true } },
    });
    expect(result).toBe(lesson);
  });

  it('preserves an explicitly provided position', async () => {
    await service.create(
      { courseId: 1, title: lesson.title, content: lesson.content, position: 3 },
      user,
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ position: 3 }),
    );
  });

  it('does not create a lesson for a missing course', async () => {
    courses.findOne.mockRejectedValue(new NotFoundException());
    await expect(
      service.create({ courseId: 999, title: 'X1', content: 'y' }, user),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each(['create', 'update', 'remove'] as const)(
    'does not %s when the shared ownership check rejects the user',
    async (operation) => {
      courses.checkOwner.mockImplementation(() => {
        throw new ForbiddenException();
      });
      const result =
        operation === 'create'
          ? service.create({ courseId: 1, title: 'Intro', content: 'Body' }, user)
          : operation === 'update'
            ? service.update(4, { title: 'Hacked' }, user)
            : service.remove(4, user);
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
    },
  );

  it('lists lessons by position and then id', async () => {
    expect(await service.findByCourse(1)).toEqual([lesson]);
    expect(courses.findOne).toHaveBeenCalledWith(1);
    expect(repo.find).toHaveBeenCalledWith({
      where: { course: { id: 1 } },
      order: { position: 'ASC', id: 'ASC' },
    });
  });

  it('returns 404 rather than an empty list for a missing course', async () => {
    courses.findOne.mockRejectedValue(new NotFoundException());
    await expect(service.findByCourse(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing lesson', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(
      'Lesson with id 999 not found',
    );
  });

  it('updates only supplied fields and reloads the lesson', async () => {
    const result = await service.update(4, { title: 'Updated' }, user);
    expect(courses.checkOwner).toHaveBeenCalledWith(lesson.course, user);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated',
        content: 'Modules, controllers, services',
        position: 1,
      }),
    );
    expect(repo.findOne).toHaveBeenCalledTimes(2);
    expect(result).toBe(lesson);
  });

  it('removes the lesson and returns its original id', async () => {
    repo.remove.mockImplementation(async (entity: Lesson) => {
      // TypeORM may clear the primary key on a removed entity.
      Object.assign(entity, { id: undefined });
    });
    expect(await service.remove(4, user)).toEqual({ id: 4, deleted: true });
    expect(courses.checkOwner).toHaveBeenCalledWith(lesson.course, user);
    expect(repo.remove).toHaveBeenCalledWith(lesson);
  });
});
