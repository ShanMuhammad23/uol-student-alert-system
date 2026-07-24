-- Batch header for each inactive-login reminder cron execution.
CREATE TABLE IF NOT EXISTS inactive_login_reminder_runs (
  id                  BIGSERIAL PRIMARY KEY,
  faculty_id          VARCHAR(32),
  inactive_days       INTEGER NOT NULL DEFAULT 7,
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

CREATE INDEX IF NOT EXISTS idx_inactive_login_reminder_runs_started
  ON inactive_login_reminder_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_inactive_login_reminder_runs_faculty
  ON inactive_login_reminder_runs (faculty_id, started_at DESC)
  WHERE faculty_id IS NOT NULL;

-- One row per staff member considered or emailed.
CREATE TABLE IF NOT EXISTS inactive_login_reminder_emails (
  id                          BIGSERIAL PRIMARY KEY,
  run_id                      BIGINT NOT NULL REFERENCES inactive_login_reminder_runs(id) ON DELETE CASCADE,
  faculty_id                  VARCHAR(32),
  status                      VARCHAR(32) NOT NULL
    CHECK (status IN (
      'sent',
      'dry_run',
      'skipped_no_email',
      'skipped_duplicate',
      'failed'
    )),
  staff_id                    VARCHAR(64),
  staff_pernr                 VARCHAR(32),
  staff_name                  VARCHAR(255),
  recipient_email             VARCHAR(255),
  source_email                VARCHAR(255),
  login_count                 INTEGER NOT NULL DEFAULT 0,
  never_logged_in             BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at               TIMESTAMPTZ,
  last_login_display          VARCHAR(128),
  email_subject               TEXT,
  body_html                   TEXT,
  error_message               TEXT,
  dry_run                     BOOLEAN NOT NULL DEFAULT FALSE,
  smtp_override_to            VARCHAR(255),
  sent_at                     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inactive_login_reminder_emails_run
  ON inactive_login_reminder_emails (run_id);

CREATE INDEX IF NOT EXISTS idx_inactive_login_reminder_emails_staff
  ON inactive_login_reminder_emails (staff_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inactive_login_reminder_emails_sent_at
  ON inactive_login_reminder_emails (sent_at DESC)
  WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inactive_login_reminder_emails_status
  ON inactive_login_reminder_emails (status, created_at DESC);
