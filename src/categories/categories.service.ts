import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Category } from './category.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
     private readonly categoriesRepo: Repository<Category>,
  ) {}

   async create(dto: CreateCategoryDto): Promise<Category> {
    if (await this.categoriesRepo.existsBy({ name: dto.name })) {
      throw new ConflictException(
        `Category "${dto.name}" already exists`,
      );
    }

    return this.categoriesRepo.save(
         this.categoriesRepo.create(dto),
    );
  }

    async findAll({ page, limit }: PaginationQueryDto) {
    const [data, total] = await this.categoriesRepo.findAndCount({
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


  async findOne(id: number): Promise<Category> {
    const category = await this.categoriesRepo.findOneBy({ id });

    if (!category) {
      throw new NotFoundException(
        `Category with id ${id} not found`,
      );
    }

    return category;
  }

  // UPDATE CATEGORY
  async update(
    id: number,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id);

    if (
      dto.name &&
      dto.name !== category.name &&
      (await this.categoriesRepo.existsBy({ name: dto.name }))
    ) {
      throw new ConflictException(
        `Category "${dto.name}" already exists`,
      );
    }

    Object.assign(category, dto);

    return this.categoriesRepo.save(category);
  }

  // DELETE CATEGORY
  async remove(id: number) {
    const category = await this.categoriesRepo.findOne({
      where: { id },
      relations: { courses: true },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with id ${id} not found`,
      );
    }

    if (category.courses.length > 0) {
      throw new ConflictException(
        'This category still has courses. Delete or move them first',
      );
    }

    await this.categoriesRepo.remove(category);

    return {
      id,
      deleted: true,
    };
  }
}