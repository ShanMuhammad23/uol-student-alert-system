BEGIN;

ALTER TABLE staff
  DROP CONSTRAINT IF EXISTS staff_role_check;

ALTER TABLE staff
  ADD CONSTRAINT staff_role_check
  CHECK (role IN ('superadmin', 'dean', 'hod', 'instructor', 'wellbeing'));

CREATE INDEX IF NOT EXISTS idx_interventions_student_latest
  ON interventions(student_sap_id, performed_at DESC);

COMMIT;
