import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { User } from './user.entity';
@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User) private readonly usersRepo: Repository<User>,
    ) { }

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
    findAll(): Promise<User[]> {
        return this.usersRepo.find({ order: { id: 'ASC' } });
    }
}