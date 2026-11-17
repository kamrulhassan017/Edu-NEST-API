
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

import { CategoriesService } from '../categories/categories.service.js';
import { Role } from '../common/enums/role.enum.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

import { Course } from './course.entity.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { QueryCourseDto } from './dto/query-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepo: Repository<Course>,
    private readonly categoriesService: CategoriesService,
  ) {}

  // CREATE COURSE
  async create(
    dto: CreateCourseDto,
    instructorId: number,
  ): Promise<Course> {
    const category = await this.categoriesService.findOne(
      dto.categoryId,
    );

    const course = this.coursesRepo.create({
      title: dto.title,
      description: dto.description,
      price: dto.price,
      totalSeats: dto.totalSeats,
      availableSeats: dto.totalSeats,
      category,
      instructor: { id: instructorId },
    });

    const saved = await this.coursesRepo.save(course);

    return this.findOne(saved.id);
  }

  // GET ALL COURSES WITH SEARCH, FILTER AND PAGINATION
  async findAll(query: QueryCourseDto) {
    const { page, limit, search, categoryId } = query;

    const where: FindOptionsWhere<Course> = {};

    if (search) {
      where.title = ILike(`%${search}%`);
    }

    if (categoryId) {
      where.category = { id: categoryId };
    }

    const [data, total] = await this.coursesRepo.findAndCount({
      where,
      relations: {
        category: true,
        instructor: true,
      },
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET SINGLE COURSE
  async findOne(id: number): Promise<Course> {
    const course = await this.coursesRepo.findOne({
      where: { id },
      relations: {
        category: true,
        instructor: true,
      },
    });

    if (!course) {
      throw new NotFoundException(
        `Course with id ${id} not found`,
      );
    }

    return course;
  }

  // CHECK COURSE OWNERSHIP
  checkOwner(course: Course, user: JwtPayload): void {
    if (
      user.role !== Role.ADMIN &&
      course.instructor.id !== user.sub
    ) {
      throw new ForbiddenException(
        'You can only change your own courses',
      );
    }
  }

  // UPDATE COURSE
  async update(
    id: number,
    dto: UpdateCourseDto,
    user: JwtPayload,
  ): Promise<Course> {
    const course = await this.findOne(id);

    this.checkOwner(course, user);

    if (dto.categoryId !== undefined) {
      course.category = await this.categoriesService.findOne(
        dto.categoryId,
      );
    }

    if (dto.totalSeats !== undefined) {
      const taken = course.totalSeats - course.availableSeats;

      if (dto.totalSeats < taken) {
        throw new BadRequestException(
          `totalSeats cannot be less than ${taken} (seats already taken)`,
        );
      }

      course.availableSeats = dto.totalSeats - taken;
      course.totalSeats = dto.totalSeats;
    }

    if (dto.title !== undefined) {
      course.title = dto.title;
    }

    if (dto.description !== undefined) {
      course.description = dto.description;
    }

    if (dto.price !== undefined) {
      course.price = dto.price;
    }

    await this.coursesRepo.save(course);

    return this.findOne(id);
  }

  // DELETE COURSE
  async remove(id: number, user: JwtPayload) {
    const course = await this.findOne(id);

    this.checkOwner(course, user);

    await this.coursesRepo.remove(course);

    return {
      id,
      deleted: true,
    };
  }
}
