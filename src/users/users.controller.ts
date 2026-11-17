import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me') // any logged-in user
    getProfile(@CurrentUser('sub') userId: number) {
        return this.usersService.findOne(userId);
    }

    @Roles(Role.ADMIN)
    @Get()
    findAll() {
        return this.usersService.findAll();
    }
}