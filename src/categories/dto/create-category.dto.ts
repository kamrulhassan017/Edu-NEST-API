
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString({
    message: 'Category name must be a string',
  })
  @IsNotEmpty({
    message: 'Category name is required',
  })
  @Length(2, 100, {
    message: 'Category name must be between 2 and 100 characters',
  })
  name: string;

  @IsOptional()
  @IsString({
    message: 'Description must be a string',
  })
  @MaxLength(500, {
    message: 'Description cannot exceed 500 characters',
  })
  description?: string;
}
