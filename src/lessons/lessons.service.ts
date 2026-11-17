import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CoursesService } from '../courses/courses.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { Lesson } from './lesson.entity';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson) private readonly lessonsRepo: Repository<Lesson>,
    private readonly coursesService: CoursesService,
  ) {}

  async create(dto: CreateLessonDto, user: JwtPayload): Promise<Lesson> {
    const course = await this.coursesService.findOne(dto.courseId);
    this.coursesService.checkOwner(course, user);
    const lesson = this.lessonsRepo.create({
      title: dto.title,
      content: dto.content,
      position: dto.position ?? 1,
      course: { id: course.id },
    });
    const saved = await this.lessonsRepo.save(lesson);
    return this.findOne(saved.id);
  }

  async findByCourse(courseId: number): Promise<Lesson[]> {
    await this.coursesService.findOne(courseId);
    return this.lessonsRepo.find({
      where: { course: { id: courseId } },
      order: { position: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Lesson> {
    const lesson = await this.lessonsRepo.findOne({
      where: { id },
      relations: { course: { instructor: true } },
    });
    if (!lesson) throw new NotFoundException(`Lesson with id ${id} not found`);
    return lesson;
  }

  async update(
    id: number,
    dto: UpdateLessonDto,
    user: JwtPayload,
  ): Promise<Lesson> {
    const lesson = await this.findOne(id);
    this.coursesService.checkOwner(lesson.course, user);
    if (dto.title !== undefined) lesson.title = dto.title;
    if (dto.content !== undefined) lesson.content = dto.content;
    if (dto.position !== undefined) lesson.position = dto.position;
    await this.lessonsRepo.save(lesson);
    return this.findOne(id);
  }

  async remove(id: number, user: JwtPayload) {
    const lesson = await this.findOne(id);
    this.coursesService.checkOwner(lesson.course, user);
    await this.lessonsRepo.remove(lesson);
    return { id, deleted: true };
  }
}
