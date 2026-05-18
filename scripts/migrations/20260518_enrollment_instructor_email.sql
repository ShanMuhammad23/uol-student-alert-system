-- Instructor email from SAP enrollment API (d:Email).
ALTER TABLE student_enrollment_current
  ADD COLUMN IF NOT EXISTS instructor_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_enroll_current_instructor_email
  ON student_enrollment_current (instructor_pernr)
  WHERE instructor_email IS NOT NULL AND TRIM(instructor_email) <> '';
