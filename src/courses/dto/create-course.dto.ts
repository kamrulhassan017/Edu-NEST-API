
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCourseDto {
  @IsString({
    message: 'Course title must be a string',
  })
  @IsNotEmpty({
    message: 'Course title is required',
  })
  @Length(3, 150, {
    message: 'Course title must be between 3 and 150 characters',
  })
  title: string;

  @IsOptional()
  @IsString({
    message: 'Description must be a string',
  })
  @MaxLength(2000, {
    message: 'Description cannot exceed 2000 characters',
  })
  description?: string;

  @IsInt({
    message: 'Price must be an integer',
  })
  @Min(0, {
    message: 'Price cannot be negative',
  })
  price: number;

  @IsInt({
    message: 'Total seats must be an integer',
  })
  @Min(1, {
    message: 'Total seats must be at least 1',
  })
  @Max(1000, {
    message: 'Total seats cannot exceed 1000',
  })
  totalSeats: number;

  @IsInt({
    message: 'Category ID must be an integer',
  })
  @Min(1, {
    message: 'Category ID must be at least 1',
  })
  categoryId: number;
}
