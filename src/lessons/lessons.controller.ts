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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonsService } from './lessons.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Lessons')
@ApiBearerAuth()
@Controller()
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

 @Get('courses/:courseId/lessons')
findByCourse(
  @Param('courseId', ParseIntPipe) courseId: number,
  @Query() query: PaginationQueryDto,
) {
  return this.lessonsService.findByCourse(courseId,query);
}

  @Get('lessons/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.findOne(id);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Post('lessons')
  create(@Body() dto: CreateLessonDto, @CurrentUser() user: JwtPayload) {
    return this.lessonsService.create(dto, user);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Patch('lessons/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.lessonsService.update(id, dto, user);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Delete('lessons/:id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.lessonsService.remove(id, user);
  }
}
