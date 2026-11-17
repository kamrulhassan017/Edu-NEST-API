import { Role } from '../enums/role.enum';

export interface JwtPayload {
    sub: number; //id
    email: string;
    role: Role;
}