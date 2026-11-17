import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Role } from '../common/enums/role.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  // ---------- Kamrul's methods (do not change) ----------
  async create(data: { name: string; email: string; password: string; role: Role }): Promise<User> {
    if (await this.usersRepo.existsBy({ email: data.email })) {
      throw new ConflictException('Email is already registered');
    }
    const hash = await bcrypt.hash(data.password, 10);
    const saved = await this.usersRepo.save(this.usersRepo.create({ ...data, password: hash }));
    return this.findOne(saved.id);
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepo.findOneBy({ id });
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  // ---------- Dhrubo's methods ----------
  async findAll({ page, limit }: PaginationQueryDto) {
    const [data, total] = await this.usersRepo.findAndCount({
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Send at least one field to update');
    }
    const user = await this.findOne(id);
    if (dto.email && dto.email !== user.email && (await this.usersRepo.existsBy({ email: dto.email }))) {
      throw new ConflictException('Email is already registered');
    }
    await this.usersRepo.update(id, { ...dto });
    return this.findOne(id);
  }

  async remove(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    const user = await this.findOne(id);
    await this.usersRepo.remove(user);
    return { id, deleted: true };
  }
}
