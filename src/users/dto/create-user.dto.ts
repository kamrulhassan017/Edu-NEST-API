import { IsEmail, IsEnum, IsNotEmpty, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class CreateUserDto {
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

  @IsEnum(Role)
  role: Role;
}
