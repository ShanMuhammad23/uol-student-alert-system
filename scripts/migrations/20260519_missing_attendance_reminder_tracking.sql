-- Batch header for each missing-attendance reminder cron execution.
CREATE TABLE IF NOT EXISTS missing_attendance_reminder_runs (
  id                  BIGSERIAL PRIMARY KEY,
  faculty_id          VARCHAR(32) NOT NULL REFERENCES faculties(id),
  snapshot_date       DATE NOT NULL,
  min_missing_entries INTEGER NOT NULL DEFAULT 4,
  dry_run             BOOLEAN NOT NULL DEFAULT FALSE,
  candidates_count    INTEGER NOT NULL DEFAULT 0,
  sent_count          INTEGER NOT NULL DEFAULT 0,
  skipped_no_email    INTEGER NOT NULL DEFAULT 0,
  skipped_duplicate   INTEGER NOT NULL DEFAULT 0,
  failed_count        INTEGER NOT NULL DEFAULT 0,
  status              VARCHAR(16) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed')),
  error_message       TEXT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ma_reminder_runs_faculty_snapshot
  ON missing_attendance_reminder_runs (faculty_id, snapshot_date DESC, started_at DESC);

-- One row per instructor/course considered or emailed.
CREATE TABLE IF NOT EXISTS missing_attendance_reminder_emails (
  id                          BIGSERIAL PRIMARY KEY,
  run_id                      BIGINT NOT NULL REFERENCES missing_attendance_reminder_runs(id) ON DELETE CASCADE,
  faculty_id                  VARCHAR(32) NOT NULL REFERENCES faculties(id),
  snapshot_date               DATE NOT NULL,
  status                      VARCHAR(32) NOT NULL
    CHECK (status IN (
      'sent',
      'dry_run',
      'skipped_no_email',
      'skipped_duplicate_instructor',
      'failed'
    )),
  instructor_pernr            VARCHAR(32),
  instructor_name             VARCHAR(255),
  recipient_email             VARCHAR(255),
  source_instructor_email     VARCHAR(255),
  course_id                   VARCHAR(64),
  course_code                 VARCHAR(64),
  course_name                 VARCHAR(255),
  department_name             VARCHAR(255),
  section_code                VARCHAR(32) NOT NULL DEFAULT '',
  event_package_id            VARCHAR(64) NOT NULL DEFAULT '',
  students_enrolled           INTEGER NOT NULL DEFAULT 0,
  classes_held                INTEGER NOT NULL DEFAULT 0,
  attendance_posted           INTEGER NOT NULL DEFAULT 0,
  missing_entries             INTEGER NOT NULL DEFAULT 0,
  email_subject               TEXT,
  body_html                   TEXT,
  error_message               TEXT,
  dry_run                     BOOLEAN NOT NULL DEFAULT FALSE,
  smtp_override_to            VARCHAR(255),
  sent_at                     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ma_reminder_emails_run
  ON missing_attendance_reminder_emails (run_id);

CREATE INDEX IF NOT EXISTS idx_ma_reminder_emails_instructor
  ON missing_attendance_reminder_emails (instructor_pernr, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_ma_reminder_emails_sent_at
  ON missing_attendance_reminder_emails (sent_at DESC)
  WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ma_reminder_emails_status
  ON missing_attendance_reminder_emails (status, created_at DESC);
