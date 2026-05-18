ALTER TABLE missing_attendance_reminder_emails
  ADD COLUMN IF NOT EXISTS cc_recipients TEXT;
