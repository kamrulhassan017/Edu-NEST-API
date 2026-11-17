import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Enrollment } from './enrollment.entity';
import { PaymentMethod } from './enrollment.enums';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Enrollment, (enrollment) => enrollment.payment, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  enrollment: Enrollment;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ length: 20, default: 'paid' })
  status: string;

  @CreateDateColumn()
  paidAt: Date;
}
