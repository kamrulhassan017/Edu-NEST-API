
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class QueryCourseDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({
    message: 'Search must be a string',
  })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Category ID must be an integer',
  })
  @Min(1, {
    message: 'Category ID must be at least 1',
  })
  categoryId?: number;
}
