
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { QueryCourseDto } from './dto/query-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
  ) {}

  // GET ALL COURSES
  @Public()
  @Get()
  findAll(@Query() query: QueryCourseDto) {
    return this.coursesService.findAll(query);
  }

  // GET COURSE BY ID
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.findOne(id);
  }

  // CREATE COURSE - INSTRUCTOR OR ADMIN
  @ApiBearerAuth()
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Post()
  create(
    @Body() dto: CreateCourseDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.coursesService.create(dto, userId);
  }

  // UPDATE COURSE - OWNER OR ADMIN
  @ApiBearerAuth()
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.update(id, dto, user);
  }

  // DELETE COURSE - OWNER OR ADMIN
  @ApiBearerAuth()
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.remove(id, user);
  }
}
