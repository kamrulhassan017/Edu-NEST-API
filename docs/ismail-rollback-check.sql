-- Run in pgAdmin before and after Postman request 10.
-- Replace 1 with the test course id. Use an isolated development database.
-- Seats, enrollment count and payment count must be identical after the 500.
SELECT
  (SELECT "availableSeats" FROM courses WHERE id = 1) AS seats,
  (SELECT COUNT(*) FROM enrollments) AS enrollments,
  (SELECT COUNT(*) FROM payments) AS payments;
