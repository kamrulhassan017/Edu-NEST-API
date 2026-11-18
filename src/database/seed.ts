import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Category } from '../categories/category.entity';
import { Role } from '../common/enums/role.enum';
import { Course } from '../courses/course.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { PaymentMethod } from '../enrollments/enrollment.enums';
import { Payment } from '../enrollments/payment.entity';
import { Lesson } from '../lessons/lesson.entity';
import { User } from '../users/user.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, Category, Course, Lesson, Enrollment, Payment],
  synchronize: true,
});

async function seed() {
  await dataSource.initialize();
  console.log('Connected. Clearing tables...');
  await dataSource.query(
    'TRUNCATE payments, enrollments, lessons, courses, categories, users RESTART IDENTITY CASCADE',
  );

  const hash = await bcrypt.hash('secret123', 10); // every seed user has password secret123

  // ---- users (ids 1-6) ----
  const userRepo = dataSource.getRepository(User);
  const [, teacher1, teacher2, student1, student2, student3] = await userRepo.save([
    userRepo.create({ name: 'Kamrul Hassan', email: 'admin@edunest.com', password: hash, role: Role.ADMIN }),
    userRepo.create({ name: 'Rupam Ahmed', email: 'teacher1@edunest.com', password: hash, role: Role.INSTRUCTOR }),
    userRepo.create({ name: 'Ismail Hossain', email: 'teacher2@edunest.com', password: hash, role: Role.INSTRUCTOR }),
    userRepo.create({ name: 'Dhrubo Roy', email: 'student1@edunest.com', password: hash, role: Role.STUDENT }),
    userRepo.create({ name: 'Nusrat Jahan', email: 'student2@edunest.com', password: hash, role: Role.STUDENT }),
    userRepo.create({ name: 'Tanvir Rahman', email: 'student3@edunest.com', password: hash, role: Role.STUDENT }),
  ]);

  // ---- categories (ids 1-3) ----
  const catRepo = dataSource.getRepository(Category);
  const [web, data, design] = await catRepo.save([
    catRepo.create({ name: 'Web Development', description: 'Frontend and backend' }),
    catRepo.create({ name: 'Data Science', description: 'Python, statistics, ML' }),
    catRepo.create({ name: 'Design', description: 'UI and UX' }),
  ]);

  // ---- courses (ids 1-4) ----
  const courseRepo = dataSource.getRepository(Course);
  const [nest, react, python, figma] = await courseRepo.save([
    courseRepo.create({
      title: 'NestJS Backend Basics',
      description: 'REST APIs with NestJS and TypeORM',
      price: 1500,
      totalSeats: 30,
      availableSeats: 28,
      category: web,
      instructor: teacher1,
    }),
    courseRepo.create({
      title: 'React for Beginners',
      description: 'Components, hooks and state',
      price: 2000,
      totalSeats: 25,
      availableSeats: 24,
      category: web,
      instructor: teacher1,
    }),
    courseRepo.create({
      title: 'Python for Data Analysis',
      description: 'Pandas and visualisation',
      price: 0,
      totalSeats: 40,
      availableSeats: 40,
      category: data,
      instructor: teacher2,
    }),
    courseRepo.create({
      title: 'Figma UI Design',
      description: 'Design a mobile app screen',
      price: 2500,
      totalSeats: 1,
      availableSeats: 0,
      category: design,
      instructor: teacher2,
    }),
  ]);

  // ---- lessons ----
  const lessonRepo = dataSource.getRepository(Lesson);
  await lessonRepo.save([
    lessonRepo.create({ title: 'Modules and controllers', content: 'How a Nest app is organised', position: 1, course: nest }),
    lessonRepo.create({ title: 'Services and DI', content: 'Dependency injection explained', position: 2, course: nest }),
    lessonRepo.create({ title: 'TypeORM entities', content: 'Mapping classes to tables', position: 3, course: nest }),
    lessonRepo.create({ title: 'JSX basics', content: 'Writing your first component', position: 1, course: react }),
    lessonRepo.create({ title: 'DataFrames', content: 'Loading and cleaning data', position: 1, course: python }),
    lessonRepo.create({ title: 'Frames and auto layout', content: 'Building responsive screens', position: 1, course: figma }),
  ]);

  // ---- enrollments + payments (seat numbers above already match these) ----
  const enrollRepo = dataSource.getRepository(Enrollment);
  const payRepo = dataSource.getRepository(Payment);

  const pairs: [User, Course, PaymentMethod][] = [
    [student1, nest, PaymentMethod.BKASH],
    [student2, nest, PaymentMethod.NAGAD],
    [student1, react, PaymentMethod.CARD],
    [student3, figma, PaymentMethod.BKASH], // Figma is now full (0 seats)
  ];

  for (const [student, course, method] of pairs) {
    const enrollment = await enrollRepo.save(enrollRepo.create({ student, course }));
    await payRepo.save(payRepo.create({ enrollment, amount: course.price, method, status: 'paid' }));
  }

  console.log('Seed complete: 6 users, 3 categories, 4 courses, 6 lessons, 4 enrollments.');
  console.log('All passwords: secret123');
  await dataSource.destroy();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
