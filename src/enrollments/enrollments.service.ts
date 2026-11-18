import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Course } from '../courses/course.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { Enrollment } from './enrollment.entity';
import { Payment } from './payment.entity';

@Injectable()
export class EnrollmentsService {
    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(Enrollment)
        private readonly enrollmentsRepo: Repository<Enrollment>,
    ) { }

    async enroll(
        studentId: number,
        dto: CreateEnrollmentDto,
    ): Promise<Enrollment> {
        // All writes use this transaction's manager, never the normal repository.
        // Throwing anywhere in the callback rolls back every change.
        const enrollmentId = await this.dataSource.transaction(async (manager) => {
            // Lock the course row until commit/rollback to prevent overbooking.
            const course = await manager.findOne(Course, {
                where: { id: dto.courseId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!course) {
                throw new NotFoundException(`Course with id ${dto.courseId} not found`);
            }
            if (course.availableSeats <= 0) {
                throw new BadRequestException('No seats left in this course');
            }

            const already = await manager.existsBy(Enrollment, {
                student: { id: studentId },
                course: { id: course.id },
            });
            if (already) {
                throw new ConflictException('You are already enrolled in this course');
            }

            // Table 1: enrollments. The unique student/course constraint is a safety net.
            const enrollment = await manager.save(
                manager.create(Enrollment, {
                    student: { id: studentId },
                    course: { id: course.id },
                }),
            );

            // Table 2: payments. The amount always comes from the course, not the client.
            await manager.save(
                manager.create(Payment, {
                    enrollment: { id: enrollment.id },
                    amount: course.price,
                    method: dto.method,
                    status: 'paid',
                }),
            );

            // Table 3: courses.
            course.availableSeats -= 1;
            await manager.save(course);

            // Demo only: fail AFTER all three writes to prove they are undone.
            if (dto.simulateFailure) {
                throw new InternalServerErrorException(
                    'Simulated payment failure: transaction rolled back',
                );
            }

            return enrollment.id;
        });

        // The transaction has committed before we load the response relations.
        return this.findOne(enrollmentId);
    }

    async findOne(id: number): Promise<Enrollment> {
        const enrollment = await this.enrollmentsRepo.findOne({
            where: { id },
            relations: { course: true, payment: true, student: true },
        });
        if (!enrollment) {
            throw new NotFoundException(`Enrollment with id ${id} not found`);
        }
        return enrollment;
    }

    findMy(studentId: number): Promise<Enrollment[]> {
        return this.enrollmentsRepo.find({
            where: { student: { id: studentId } },
            relations: { course: true, payment: true },
            order: { enrolledAt: 'DESC' },
        });
    }

    async findAll({ page, limit }: PaginationQueryDto) {
        const [data, total] = await this.enrollmentsRepo.findAndCount({
            relations: { student: true, course: true, payment: true },
            order: { id: 'ASC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return {
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
}
