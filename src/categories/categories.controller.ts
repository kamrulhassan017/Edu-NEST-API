import{
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
import {ApiBearerAuth,ApiTags} from '@nestjs/swagger';

import {Public } from '../common/decorators/public.decorator.js';
import{Roles} from '../common/decorators/roles.decorator.js';
import{PaginationQueryDto} from '../common/dto/pagination-query.dto.js';
import {Role} from '../common/enums/role.enum.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}


  @Public()
    @Get()
    findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.categoriesService.findAll(paginationQuery);
  }

    @Public()
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }


  @ApiBearerAuth()
    @Roles(Role.ADMIN)
    @Post()
    create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }


  @ApiBearerAuth()
    @Roles(Role.ADMIN)
    @Patch(':id')
    update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }



    @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }
}