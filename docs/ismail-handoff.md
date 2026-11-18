# Ismail — Member 3 handoff

Source: `EduNest_Guide_Ismail.pdf` (16 pages). Branch: `feature/ismail-enrollments`.

## Implemented

- All 6 lesson files in `src/lessons/`: entity, create/update DTOs, service, controller and module.
- All 7 enrollment/payment files in `src/enrollments/`: enum, entities, DTO, service, controller and module.
- Both modules registered in `src/app.module.ts`.
- Missing shared `src/common/dto/pagination-query.dto.ts` added: page 1, limit 10, positive integers, maximum limit 100, query-string conversion.
- Lesson writes delegate ownership checks to the shared CoursesService; reads require login.
- Enrollment uses the JWT subject, a pessimistic course-row lock, one transaction manager for all three writes, duplicate protection and the rollback-demo flag.
- Student-only enrollment creation/own list and admin-only paginated list.
- Report draft: `docs/ismail-report.md`.
- The PDF's 14 Postman requests: `docs/ismail.postman_collection.json`.
- Before/after rollback query: `docs/ismail-rollback-check.sql`.

## Integration dependency — intentionally not implemented here

The user requested proceeding with Ismail's work without waiting for Rupam. This branch does **not** invent or replace Rupam's Course/Category modules. As a result, the application cannot currently compile/start: the imports below are unresolved. The unit-test doubles are not runtime substitutes.

Required from the Course module, matching the PDF:

| File | Required contract |
| --- | --- |
| `src/courses/course.entity.ts` | Export `Course` with `id`, integer `price`, integer `availableSeats`, and `instructor` relation to `User`. |
| `src/courses/courses.service.ts` | Export `CoursesService`; `findOne(id)` loads instructor and throws 404 if absent; synchronous `checkOwner(course, user)` permits the owning instructor/admin and otherwise throws 403. |
| `src/courses/courses.module.ts` | Export `CoursesModule`, register `Course` with `TypeOrmModule.forFeature`, and export `CoursesService`. |

`LessonsModule` imports `CoursesModule`; the PDF's merged AppModule also imports the Course and Category modules. Keep every module once when merging. Reconcile the shared pagination DTO if the other branch adds one too.

No production stubs, `ts-ignore`, disabled guards, or ambient fake Course declarations were added to conceal this dependency.

## Automated checks

```bash
npm ci
npm test -- --runInBand --runTestsByPath src/lessons/lessons.service.spec.ts src/enrollments/enrollments.service.spec.ts test/ismail.http.spec.ts
```

Result at implementation: **69 tests passed, 3 suites**.

- Lesson service tests: shared ownership checks, missing resources, creation/default position, ordered listing, patch and delete.
- Enrollment service tests: lock options, three writes through the transaction manager, server-derived amount, duplicate/full/missing course, exception propagation, demo failure after all writes, student filtering and pagination.
- HTTP-contract tests use real controllers, JWT/role guards, validation and exception filter with mocked services. They cover roles, JWT subject, parsing, allowed payment methods, forbidden client-controlled fields, pagination and status codes.

These tests **do not prove PostgreSQL rollback, locking under concurrency, database constraints, or the real CoursesService ownership implementation**. The service tests use virtual Course doubles solely to exercise Ismail's code before integration. VS Code currently reports missing Course imports and consequent missing Course-property types. A clean application build is not claimed.

The existing `test/app.e2e-spec.ts` is an untouched starter test for `Hello World!`; it is not the PDF's API test suite and will need team integration updates.

## Run the PDF's Postman checks after integration

1. Create a local PostgreSQL database named `edunest`. Copy `.env.example` to `.env`; fill in your local credentials and a JWT secret of at least 16 characters. Never commit `.env` or tokens.
2. Once the Course module is available, run `npm run start:dev`. Verify the `lessons`, `enrollments` and `payments` tables appear.
3. In a disposable development database, register an admin candidate, two instructors (owner and non-owner), and three different students through `POST /auth/register`. Only student/instructor self-registration is allowed.
4. Promote only the test admin using pgAdmin, then log in again to receive an admin JWT:

   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'admin@test.com';
   ```

5. Log in each account with `POST /auth/login`. Import `docs/ismail.postman_collection.json` into Postman and set its local variables: `baseUrl`, `adminToken`, `instructorToken`, `otherInstructorToken`, `studentToken`, `student2Token`, `student3Token`. Do not export populated tokens into Git.
6. Create a category as admin and a course as the owner instructor, using the merged team's DTOs. Give the course **2 total/available seats** and no existing enrollments. Set `courseId` to its id and `missingCourseId` to an id that does not exist. Request 1 captures `lessonId` automatically.
7. Run requests **1–9** in order, taking a screenshot of each response.
8. Before request **10**, run `docs/ismail-rollback-check.sql` (replace course id 1 if needed) and screenshot the counts. Send request 10 with student 2, screenshot the expected 500, rerun the same SQL, and screenshot unchanged seats/enrollments/payments. The enrollment/payment sequences may have gaps after rollback; compare counts, not sequence values.
9. Run requests **11–14** in order, screenshotting each response. Request 11 must succeed for the same student who attempted the failed transaction. Request 12 must reject a third student because no seats remain.
10. Also manually verify GET/PATCH/DELETE `/lessons/:id`, a missing lesson (404), requests without JWTs (401), invalid pagination (400), and instructor/admin authorization. For concurrency, use a separate course with one seat and two different students: send enrollment requests simultaneously. Exactly one should succeed, the other should receive 400, seats must be zero, and exactly one enrollment/payment pair must exist for that course.

Use a fresh course and update `courseId` when rerunning the ordered collection; it intentionally changes data. The collection's assertions are expected outcomes, not recorded results. No Postman screenshots or live PostgreSQL results have been fabricated.

Rollback caption from the guide:

> Enrollment transaction rolled back after a simulated payment failure. Seats, enrollments and payments are unchanged.

## Before submitting

- Complete database-backed checks and screenshots after Course integration.
- Update the report's pending team endpoints and replace illustrative examples with verified responses.
- Inspect `git status` and review only intended files. Keep `.env`, tokens and `node_modules` out of Git.
- Commit/push `feature/ismail-enrollments`, open a PR against `main`, and notify Kamrul when ready. No commit, remote push, PR, account changes or global Git identity changes were performed automatically.

`simulateFailure` and the `paid` status are the PDF's classroom demonstration, **not a real payment gateway**. Disable the failure hook and implement verified gateway payments before production use.
