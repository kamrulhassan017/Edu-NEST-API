import {
    IsEmail, IsIn, IsNotEmpty, IsOptional,
    IsString, Length, MaxLength, MinLength
}
    from 'class-validator';
import { Role } from '../../common/enums/role.enum';
export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    @Length(2, 100)
    name: string;

    @IsEmail()
    email: string;
    @IsString()
    @MinLength(6)
    @MaxLength(50)
    password: string;
    @IsOptional()
    @IsIn([Role.STUDENT, Role.INSTRUCTOR])
    role?: Role;
}