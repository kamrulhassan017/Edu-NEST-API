# EduNest API — Ismail's report sections

**Draft for Chapters 5, 7 and 8, based on `EduNest_Guide_Ismail.pdf`.**

This draft distinguishes implemented source from the final team's intended scope. Ismail's source and isolated tests are complete, but live integration depends on the absent Course module. Examples below are illustrative, not captured API responses. Replace them with verified responses/screenshots before submission. Do not claim that all five project requirements, six entities or approximately 25 endpoints have been verified until the complete team application is integrated.

## Chapter 5 — List of APIs

### Routes present in this branch's source

| Module | Method | Path | Role | Purpose |
| --- | --- | --- | --- | --- |
| Auth | POST | `/auth/register` | Public | Create a student/instructor account and return JWT |
| Auth | POST | `/auth/login` | Public | Authenticate and return JWT |
| Users | GET | `/users/me` | Any logged-in user | Read own profile |
| Users | GET | `/users` | Admin | List users; currently not paginated |
| Lessons | GET | `/courses/:courseId/lessons` | Any logged-in user | List lessons ordered by position, then id |
| Lessons | GET | `/lessons/:id` | Any logged-in user | Read a lesson with course/instructor |
| Lessons | POST | `/lessons` | Owner instructor or admin | Create a lesson |
| Lessons | PATCH | `/lessons/:id` | Owner instructor or admin | Update a lesson without changing its course |
| Lessons | DELETE | `/lessons/:id` | Owner instructor or admin | Delete a lesson |
| Enrollments | POST | `/enrollments` | Student | Create enrollment/payment and decrement seats atomically |
| Enrollments | GET | `/enrollments/my` | Student | Read only the authenticated student's enrollments |
| Enrollments | GET | `/enrollments?page=1&limit=10` | Admin | List all enrollments with pagination metadata |

Lesson/enrollment routes are implemented but cannot run in the full application until the Course dependency is available. Role restrictions come from the global guards; lesson ownership is delegated to the shared CoursesService.

### Additional team routes required by the PDF — not present yet

| Module | Method | Path | Intended role | Intended purpose |
| --- | --- | --- | --- | --- |
| Users | GET | `/users/:id` | Admin | Read one user |
| Users | POST | `/users` | Admin | Create a user with any role |
| Users | PATCH | `/users/:id` | Admin | Update name/email/role/isActive |
| Users | DELETE | `/users/:id` | Admin | Delete a user, not self |
| Categories | GET | `/categories`, `/categories/:id` | Public | Paginated list and one category |
| Categories | POST | `/categories` | Admin | Create a category |
| Categories | PATCH / DELETE | `/categories/:id` | Admin | Update/delete a category |
| Courses | GET | `/courses` | Public | Search/filter/paginate courses |
| Courses | GET | `/courses/:id` | Public | Read a course with category and instructor |
| Courses | POST | `/courses` | Instructor or admin | Create a course |
| Courses | PATCH / DELETE | `/courses/:id` | Owner instructor or admin | Update/delete a course |

Also pending from the final team API table: pagination for `GET /users`. Reconcile these rows against the merged controllers, not merely the PDF, before presenting them as available endpoints.

### Example requests and responses

All examples use `Content-Type: application/json`. Protected requests additionally use `Authorization: Bearer <accessToken>`. Response snippets omit unrelated fields, and ids/timestamps/tokens are placeholders.

#### Register

`POST /auth/register`

```json
{
  "name": "Test Student",
  "email": "student@test.com",
  "password": "secret123"
}
```

Expected 201; selected response fields:

```json
{
  "user": {
    "id": 3,
    "name": "Test Student",
    "email": "student@test.com",
    "role": "student",
    "isActive": true
  },
  "accessToken": "<JWT>"
}
```

Student is the default role. Registration may explicitly select `instructor`, but not `admin`. Password hashes are excluded from the response.

#### Login

`POST /auth/login`

```json
{ "email": "student@test.com", "password": "secret123" }
```

Expected 200 (`@HttpCode(HttpStatus.OK)` on the login route); selected response fields:

```json
{
  "user": { "id": 3, "email": "student@test.com", "role": "student" },
  "accessToken": "<JWT>"
}
```

#### Create course — provisional team example

The Course module is not available in this branch. The following example must be checked against its actual DTO/response after integration; it is not an implemented contract or a successful request captured here.

`POST /courses` with the owner instructor's token:

```json
{
  "title": "NestJS Basics",
  "description": "Modules, controllers and services",
  "categoryId": 1,
  "price": 1500,
  "totalSeats": 2
}
```

Intended 201; illustrative selected fields:

```json
{
  "id": 1,
  "title": "NestJS Basics",
  "price": 1500,
  "totalSeats": 2,
  "availableSeats": 2,
  "instructor": { "id": 2 }
}
```

#### Enroll

`POST /enrollments` with the student's token:

```json
{ "courseId": 1, "method": "bkash" }
```

Expected 201 for a course with seats and no existing enrollment for that student; selected response fields:

```json
{
  "id": 1,
  "student": { "id": 3, "email": "student@test.com", "role": "student" },
  "course": { "id": 1, "price": 1500, "availableSeats": 1 },
  "payment": { "id": 1, "amount": 1500, "method": "bkash", "status": "paid" }
}
```

The student id comes from the JWT, and payment amount comes from the locked course row. The client cannot submit either value. Accepted methods are `bkash`, `nagad`, and `card`; these are simulated payment records, not actual charges.

#### Pagination

`GET /enrollments?page=1&limit=10` with an admin token returns `{ "data": [...], "meta": { "total": 2, "page": 1, "limit": 10, "totalPages": 1 } }`. Defaults are page 1 and limit 10; limit is capped at 100 by DTO validation.

### Status codes

| Code | Example |
| --- | --- |
| 200 | Read lessons, update/delete a lesson, list enrollments |
| 201 | Create a lesson or successful enrollment |
| 400 | Invalid payment method, invalid pagination, or no seats left |
| 401 | Missing, invalid or expired JWT on a protected route |
| 403 | Student creating a lesson, instructor enrolling, or non-owner modifying a lesson |
| 404 | Lesson/course id does not exist |
| 409 | Student already enrolled while seats remain, or database unique-constraint violation |
| 500 | `simulateFailure: true` throws after the three transaction writes |

The PDF checks seat availability before duplicate enrollment. Consequently an already-enrolled student retrying a completely full course receives 400 rather than 409; Postman test 7 runs while one seat is still free.

The global error format is:

```json
{
  "success": false,
  "statusCode": 500,
  "message": "Simulated payment failure: transaction rolled back",
  "path": "/enrollments",
  "timestamp": "<ISO timestamp>"
}
```

## Chapter 7 — Implementation highlights

### 1. Transaction and row lock

Excerpt from `src/enrollments/enrollments.service.ts`:

```ts
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
```

PostgreSQL's `SELECT ... FOR UPDATE` locks the selected course row until commit or rollback. A second enrollment for the same course must wait and then read the updated seat count. The remainder of this callback inserts an Enrollment, inserts its Payment at the course's price, and reduces `availableSeats` by one, always using the transaction manager. Exceptions propagate out of the callback so TypeORM rolls all changes back. The demo intentionally throws only after all three writes. After commit, the service reloads course, student and payment relations. The unique `(student, course)` constraint separately prevents duplicate enrollment, and the payment-side one-to-one foreign key allows at most one payment per enrollment.

Database-backed evidence is still pending: run the 14 Postman checks and compare `docs/ismail-rollback-check.sql` results before/after the simulated failure. Automated mocks verify the exception location and manager usage, not actual database atomicity or locking.

### 2. Protected by default with a public-route exception

Excerpt from `src/common/guards/jwt-auth.guard.ts`:

```ts
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  context.getHandler(),
  context.getClass(),
]);
if (isPublic) return true;

const request = context.switchToHttp().getRequest<AuthRequest>();
const [type, token] = request.headers.authorization?.split(' ') ?? [];
if (type !== 'Bearer' || !token) {
  throw new UnauthorizedException('Missing access token');
}
```

AppModule registers JwtAuthGuard as the first global guard. Only routes explicitly annotated with `@Public()` bypass authentication. Other routes require a valid Bearer token; the remaining guard code verifies it and places its payload on the request. Consequently lesson reads need no explicit role decorator to require login. `@CurrentUser('sub')` reads the authenticated student's id instead of trusting an id supplied in the enrollment body.

### 3. Role-based authorization

Excerpt from `src/common/guards/roles.guard.ts`:

```ts
const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
  context.getHandler(),
  context.getClass(),
]);
if (!required || required.length === 0) return true;

const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
if (!user || !required.includes(user.role)) {
  throw new ForbiddenException('You do not have permission to perform this action');
}
return true;
```

RolesGuard runs after authentication and reads `@Roles(...)` metadata. Enrollment creation and the own-enrollments route are student-only, while the full enrollment list is admin-only. Lesson writes allow instructors and admins at the controller level, then invoke the shared CoursesService ownership check in the service. A role check alone does not establish ownership; both layers are necessary.

### 4. Consistent exception responses

Excerpt from `src/common/filters/http-exception.filter.ts`:

```ts
} else if (exception instanceof QueryFailedError) {
  const code = exception.driverError?.code as string | undefined;
  if (code === '23505') {
    status = HttpStatus.CONFLICT;
    message = 'A record with this value already exists';
  } else if (code === '23503') {
    status = HttpStatus.BAD_REQUEST;
    message = 'Related record does not exist';
  } else {
    this.logger.error(exception.message);
  }
```

The shared filter translates PostgreSQL unique-constraint failures (`23505`) into 409 and foreign-key failures (`23503`) into 400. Nest HTTP exceptions retain their intended status/message. All paths return the same `success`, `statusCode`, `message`, `path`, and `timestamp` structure, while unexpected internal errors are logged rather than exposing database details. This also makes the deliberately simulated transaction failure easy to demonstrate consistently.

### 5. Pagination

Excerpt from `src/enrollments/enrollments.service.ts`:

```ts
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
```

The pagination DTO transforms numeric query strings, supplies defaults, rejects invalid values and bounds the page size. `skip` and `take` limit the query, while `findAndCount` provides the total for metadata. Ordering by id makes pages deterministic. The guide also proposes a Course search excerpt using `ILike`; that code belongs to the absent Course module and must be reviewed after integration before describing its behavior as implemented.

## Chapter 8 — Conclusion

### Achievements

Ismail's contribution implements lesson CRUD, role-restricted enrollment APIs, the Enrollment/Payment relationship, a unique student/course constraint, and an enrollment transaction spanning three tables with an explicit rollback demonstration. It reuses the team's JWT guard, role guard, custom decorators, validation and consistent exception format. Environment validation and custom decorators are already present as the guide's two bonus features. The isolated test suite covers 69 service and HTTP-contract cases.

The complete project targets six entities (User, Category, Course, Lesson, Enrollment and Payment), approximately 25 endpoints and the course's five minimum requirements. This branch alone does not establish completion of those team-wide targets. Course/Category source, the remaining user-management endpoints, integrated execution and report screenshots must be verified before the final submission.

### Challenges

- Concurrent students can compete for the final seat. The enrollment design uses a database transaction and a pessimistic row lock rather than a separate unprotected read/update. A real simultaneous-request test remains required.
- A partial enrollment/payment write would leave inconsistent data. All three writes use the callback's EntityManager; a late failure triggers rollback.
- Duplicate enrollments need both a friendly application-level error and a database uniqueness constraint as the final safeguard.
- Shared module ownership requires a clear integration contract. Ismail's tests isolate the missing Course dependency without shipping a fake production Course implementation.
- Secrets must stay out of Git: database credentials and JWT secrets belong in `.env`, and Postman tokens must remain local.

### Limitations

- The current branch cannot start the full app without the Course dependency.
- No frontend, real payment gateway, refresh-token flow, cancellation/refunds or email receipts are implemented here.
- Payment records marked `paid` are simulations; `simulateFailure` is a classroom demo hook, not a production payment feature.
- Schema creation uses `synchronize: true` rather than versioned migrations.
- Database rollback/concurrency results and Postman screenshots are not yet collected.

### Future work

Integrate and verify all team modules, replace schema synchronization with migrations, use a real payment gateway with verified payment status, add refunds/cancellation and email receipts, complete Swagger/OpenAPI documentation, and add database-backed integration/concurrency tests. Remove or restrict the failure-demo hook before deployment.

### References

- NestJS documentation: https://docs.nestjs.com/
- TypeORM transactions: https://typeorm.io/docs/advanced-topics/transactions/
- TypeORM relations: https://typeorm.io/docs/relations/relations/
- PostgreSQL transactions: https://www.postgresql.org/docs/current/tutorial-transactions.html
- PostgreSQL explicit locking: https://www.postgresql.org/docs/current/explicit-locking.html
- CSC4161 Advance Programming in Web Technology lecture slides (add the actual lecture identifiers supplied by the instructor).
- `EduNest_Guide_Ismail.pdf`, Member 3 guide, pages 1–16.

## Viva preparation

- **Transaction:** a group of operations committed together or rolled back together.
- **ACID:** atomicity, consistency, isolation and durability.
- **Three changed tables:** insert enrollments, insert payments, decrement courses.availableSeats.
- **Rollback proof:** unchanged seat/enrollment/payment counts before and after `simulateFailure: true`; sequence gaps are normal.
- **`pessimistic_write`:** PostgreSQL row lock (`SELECT ... FOR UPDATE`) held until the transaction ends.
- **Why the transaction manager:** it binds every query to the transaction connection; a normal repository can run outside it.
- **Many-to-many:** Enrollment is the explicit student/course join entity with its own date and payment relation.
- **Payment foreign key:** `payments.enrollmentId`, because Payment owns `@JoinColumn()`.
- **`existsBy` plus unique constraint:** a friendly pre-check plus database enforcement.
- **`position` instead of `order`:** `ORDER` is a SQL keyword.
