-- Split wellbeing role into wellbeing-head and wellbeing-counseller.
-- Keep legacy 'wellbeing' for backward compatibility.

ALTER TABLE staff
  DROP CONSTRAINT IF EXISTS staff_role_check;

ALTER TABLE staff
  ADD CONSTRAINT staff_role_check
  CHECK (
    role IN (
      'superadmin',
      'dean',
      'hod',
      'instructor',
      'wellbeing',
      'wellbeing-head',
      'wellbeing-counseller'
    )
  );
