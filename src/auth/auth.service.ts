import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) { }

    async register(dto: RegisterDto) {
        const user = await this.usersService.create({ ...dto, role: dto.role ?? Role.STUDENT });
        return { user, accessToken: await this.signToken(user) };
    }

    async login(dto: LoginDto) {
        const user = await this.usersService.findByEmailWithPassword(dto.email);
        if (!user || !(await bcrypt.compare(dto.password, user.password))) {
            throw new UnauthorizedException('Invalid email or password');
        }
        if (!user.isActive) throw new ForbiddenException('Account is disabled');

        const { password: _hash, ...safeUser } = user;
        return { user: safeUser, accessToken: await this.signToken(user) };
    }

    private signToken(user: User): Promise<string> {
        const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
        return this.jwtService.signAsync(payload);
    }
}