import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Course } from '../courses/course.entity';
import { User } from '../users/user.entity';
import { Payment } from './payment.entity';

@Entity('enrollments')
@Unique(['student', 'course'])
export class Enrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  student: User;

  @ManyToOne(() => Course, { nullable: false, onDelete: 'CASCADE' })
  course: Course;

  @OneToOne(() => Payment, (payment) => payment.enrollment)
  payment: Payment;

  @CreateDateColumn()
  enrolledAt: Date;
}
