import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { EnrollmentsService } from './enrollments.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Enrollments')
@ApiBearerAuth()
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Roles(Role.STUDENT)
  @Post()
  enroll(
    @Body() dto: CreateEnrollmentDto,
    @CurrentUser('sub') studentId: number,
  ) {
    return this.enrollmentsService.enroll(studentId, dto);
  }

  @Roles(Role.STUDENT)
  @Get('my') // Keep above any future ':id' route.
  findMy(@CurrentUser('sub') studentId: number) {
    return this.enrollmentsService.findMy(studentId);
  }

  @Roles(Role.ADMIN)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.enrollmentsService.findAll(query);
  }
}
