-- Effectiveness Index (EI) criteria — instructor dimension + EI columns

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS login_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_staff_last_login_at
  ON staff (last_login_at DESC)
  WHERE last_login_at IS NOT NULL;

ALTER TABLE interventions DROP CONSTRAINT IF EXISTS interventions_status_check;
ALTER TABLE interventions
  ADD CONSTRAINT interventions_status_check
  CHECK (status IN ('initiated', 'in-progress', 'referred', 'resolved', 'no-action-required'));

CREATE INDEX IF NOT EXISTS idx_interventions_student_performed
  ON interventions (student_sap_id, performed_at);

ALTER TABLE effectiveness_scores_by_dimension
  DROP CONSTRAINT IF EXISTS effectiveness_scores_by_dimension_dimension_type_check;

ALTER TABLE effectiveness_scores_by_dimension
  ADD CONSTRAINT effectiveness_scores_by_dimension_dimension_type_check
  CHECK (dimension_type IN ('faculty', 'department', 'instructor'));

ALTER TABLE effectiveness_scores_by_dimension
  ADD COLUMN IF NOT EXISTS ei_score    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS ei_rating   VARCHAR(2),
  ADD COLUMN IF NOT EXISTS login_users_meeting_pi INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS login_total_users      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS classes_held_total     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS classes_posted_total   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_alerts           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alerts_with_intervention INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_faculty_cases     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faculty_cases_progression_ok INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faculty_total_cases    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faculty_cases_closed_or_referred INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS median_days_to_first_action NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS wb_referred_cases      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wb_median_days_to_uptake NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS wb_open_cases          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wb_cases_progression_ok INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wb_cases_closed        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS criteria_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_effectiveness_ei_rating
  ON effectiveness_scores_by_dimension (snapshot_date, ei_rating);

CREATE INDEX IF NOT EXISTS idx_effectiveness_instructor
  ON effectiveness_scores_by_dimension (dimension_type, dimension_id, snapshot_date DESC)
  WHERE dimension_type = 'instructor';
