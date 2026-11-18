import { InternalServerErrorException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Role } from '../src/common/enums/role.enum';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { EnrollmentsController } from '../src/enrollments/enrollments.controller';
import { EnrollmentsService } from '../src/enrollments/enrollments.service';
import { LessonsController } from '../src/lessons/lessons.controller';
import { LessonsService } from '../src/lessons/lessons.service';

// Real controllers, JWT/role guards, DTOs and error filter; mocked persistence.
// This suite intentionally does not load AppModule or the missing Course module.
jest.mock('../src/lessons/lessons.service', () => ({
  LessonsService: class LessonsService {},
}));
jest.mock('../src/enrollments/enrollments.service', () => ({
  EnrollmentsService: class EnrollmentsService {},
}));

describe('Ismail HTTP contracts (mocked services)', () => {
  let app: INestApplication;
  const jwt = new JwtService({ secret: 'ismail-tests-only-not-a-real-secret' });
  const token = (role: Role, sub = 7) =>
    jwt.sign({ sub, role, email: 'test@example.com' });
  const lessons = {
    create: jest.fn().mockResolvedValue({ id: 4 }),
    findByCourse: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 4 }),
    update: jest.fn().mockResolvedValue({ id: 4 }),
    remove: jest.fn().mockResolvedValue({ id: 4, deleted: true }),
  };
  const enrollments = {
    enroll: jest.fn().mockResolvedValue({ id: 20 }),
    findMy: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  };
  const lessonBody = { courseId: 1, title: 'Intro', content: 'NestJS basics' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LessonsController, EnrollmentsController],
      providers: [
        { provide: LessonsService, useValue: lessons },
        { provide: EnrollmentsService, useValue: enrollments },
        { provide: JwtService, useValue: jwt },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app?.close());

  it.each(['/courses/1/lessons', '/lessons/4', '/enrollments/my', '/enrollments'])(
    'protects GET %s without a token',
    async (path) => {
      const response = await request(app.getHttpServer()).get(path).expect(401);
      expect(response.body).toMatchObject({
        success: false,
        statusCode: 401,
        path,
        message: 'Missing access token',
      });
    },
  );

  it('rejects an invalid JWT', async () => {
    await request(app.getHttpServer())
      .get('/lessons/4')
      .auth('invalid-token', { type: 'bearer' })
      .expect(401);
  });

  it.each(Object.values(Role))('allows %s to read lessons', async (role) => {
    await request(app.getHttpServer())
      .get('/courses/1/lessons')
      .auth(token(role), { type: 'bearer' })
      .expect(200);
    expect(lessons.findByCourse).toHaveBeenCalledWith(1);
    await request(app.getHttpServer())
      .get('/lessons/4')
      .auth(token(role), { type: 'bearer' })
      .expect(200);
    expect(lessons.findOne).toHaveBeenCalledWith(4);
  });

  it.each([Role.INSTRUCTOR, Role.ADMIN])('allows %s lesson writes', async (role) => {
    const auth = token(role);
    await request(app.getHttpServer())
      .post('/lessons')
      .auth(auth, { type: 'bearer' })
      .send(lessonBody)
      .expect(201);
    expect(lessons.create).toHaveBeenCalledWith(
      expect.objectContaining(lessonBody),
      expect.objectContaining({ sub: 7, role }),
    );
    await request(app.getHttpServer())
      .patch('/lessons/4')
      .auth(auth, { type: 'bearer' })
      .send({ title: 'Updated' })
      .expect(200);
    await request(app.getHttpServer())
      .delete('/lessons/4')
      .auth(auth, { type: 'bearer' })
      .expect(200, { id: 4, deleted: true });
  });

  it('rejects student lesson writes', async () => {
    const auth = token(Role.STUDENT);
    await request(app.getHttpServer())
      .post('/lessons')
      .auth(auth, { type: 'bearer' })
      .send(lessonBody)
      .expect(403);
    await request(app.getHttpServer())
      .patch('/lessons/4')
      .auth(auth, { type: 'bearer' })
      .send({ title: 'Hacked' })
      .expect(403);
    await request(app.getHttpServer())
      .delete('/lessons/4')
      .auth(auth, { type: 'bearer' })
      .expect(403);
    expect(lessons.create).not.toHaveBeenCalled();
    expect(lessons.update).not.toHaveBeenCalled();
    expect(lessons.remove).not.toHaveBeenCalled();
  });

  it.each([
    { courseId: 0 },
    { courseId: '1' },
    { title: 'X' },
    { title: 'x'.repeat(151) },
    { content: '' },
    { position: 0 },
    { position: 1.5 },
    { unexpected: true },
  ])('rejects an invalid lesson body: %j', async (invalid) => {
    await request(app.getHttpServer())
      .post('/lessons')
      .auth(token(Role.INSTRUCTOR), { type: 'bearer' })
      .send({ ...lessonBody, ...invalid })
      .expect(400);
    expect(lessons.create).not.toHaveBeenCalled();
  });

  it('does not allow moving a lesson to another course', async () => {
    await request(app.getHttpServer())
      .patch('/lessons/4')
      .auth(token(Role.INSTRUCTOR), { type: 'bearer' })
      .send({ courseId: 2 })
      .expect(400);
    expect(lessons.update).not.toHaveBeenCalled();
  });

  it.each(['/lessons/not-an-id', '/courses/not-an-id/lessons'])(
    'rejects a noninteger path parameter: %s',
    async (path) => {
      await request(app.getHttpServer())
        .get(path)
        .auth(token(Role.STUDENT), { type: 'bearer' })
        .expect(400);
    },
  );

  it.each(['bkash', 'nagad', 'card'])(
    'enrolls the authenticated student with %s',
    async (method) => {
      await request(app.getHttpServer())
        .post('/enrollments')
        .auth(token(Role.STUDENT, 9), { type: 'bearer' })
        .send({ courseId: 1, method })
        .expect(201);
      expect(enrollments.enroll).toHaveBeenCalledWith(
        9,
        expect.objectContaining({ courseId: 1, method }),
      );
    },
  );

  it('passes the rollback-demo flag and formats the service failure as 500', async () => {
    enrollments.enroll.mockRejectedValueOnce(
      new InternalServerErrorException(
        'Simulated payment failure: transaction rolled back',
      ),
    );
    const response = await request(app.getHttpServer())
      .post('/enrollments')
      .auth(token(Role.STUDENT), { type: 'bearer' })
      .send({ courseId: 1, method: 'nagad', simulateFailure: true })
      .expect(500);
    expect(enrollments.enroll).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ simulateFailure: true }),
    );
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 500,
      message: 'Simulated payment failure: transaction rolled back',
      path: '/enrollments',
    });
  });

  it.each([
    { method: 'cash' },
    { courseId: 0 },
    { courseId: 1.5 },
    { simulateFailure: 'true' },
    { studentId: 99 },
    { amount: 1 },
  ])('rejects invalid or client-controlled enrollment fields: %j', async (invalid) => {
    await request(app.getHttpServer())
      .post('/enrollments')
      .auth(token(Role.STUDENT), { type: 'bearer' })
      .send({ courseId: 1, method: 'bkash', ...invalid })
      .expect(400);
    expect(enrollments.enroll).not.toHaveBeenCalled();
  });

  it.each([Role.INSTRUCTOR, Role.ADMIN])(
    'rejects %s on student-only enrollment routes',
    async (role) => {
      await request(app.getHttpServer())
        .post('/enrollments')
        .auth(token(role), { type: 'bearer' })
        .send({ courseId: 1, method: 'card' })
        .expect(403);
      await request(app.getHttpServer())
        .get('/enrollments/my')
        .auth(token(role), { type: 'bearer' })
        .expect(403);
    },
  );

  it('uses the JWT subject for the student enrollment list', async () => {
    await request(app.getHttpServer())
      .get('/enrollments/my')
      .auth(token(Role.STUDENT, 9), { type: 'bearer' })
      .expect(200);
    expect(enrollments.findMy).toHaveBeenCalledWith(9);
  });

  it.each([Role.STUDENT, Role.INSTRUCTOR])(
    'rejects %s on the admin enrollment list',
    async (role) => {
      await request(app.getHttpServer())
        .get('/enrollments')
        .auth(token(role), { type: 'bearer' })
        .expect(403);
      expect(enrollments.findAll).not.toHaveBeenCalled();
    },
  );

  it('defaults pagination to page 1 and limit 10', async () => {
    await request(app.getHttpServer())
      .get('/enrollments')
      .auth(token(Role.ADMIN), { type: 'bearer' })
      .expect(200);
    expect(enrollments.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('transforms pagination query strings into integers', async () => {
    await request(app.getHttpServer())
      .get('/enrollments?page=2&limit=5')
      .auth(token(Role.ADMIN), { type: 'bearer' })
      .expect(200);
    expect(enrollments.findAll).toHaveBeenCalledWith({ page: 2, limit: 5 });
  });

  it.each(['page=0', 'page=abc', 'page=1.5', 'limit=0', 'limit=101', 'limit=-1'])(
    'rejects invalid pagination: %s',
    async (query) => {
      await request(app.getHttpServer())
        .get(`/enrollments?${query}`)
        .auth(token(Role.ADMIN), { type: 'bearer' })
        .expect(400);
      expect(enrollments.findAll).not.toHaveBeenCalled();
    },
  );
});
