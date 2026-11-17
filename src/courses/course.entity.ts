
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity';
import { User } from '../users/user.entity';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'int' })
  totalSeats: number;

  @Column({ type: 'int' })
  availableSeats: number;

  @ManyToOne(() => Category, (category) => category.courses, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  category: Category;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  instructor: User;

  @CreateDateColumn()
  createdAt: Date;
}
