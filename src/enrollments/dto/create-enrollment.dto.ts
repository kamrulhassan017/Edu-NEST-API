import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaymentMethod } from '../enrollment.enums';

export class CreateEnrollmentDto {
  @IsInt()
  @Min(1)
  courseId: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  // Demo only: fail after all three writes so PostgreSQL rolls them back.
  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}
