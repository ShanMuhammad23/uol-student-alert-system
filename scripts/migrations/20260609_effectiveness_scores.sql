-- Faculty / department effectiveness scores (FEI) — nightly snapshot
CREATE TABLE IF NOT EXISTS effectiveness_scores_by_dimension (
  snapshot_date               DATE NOT NULL,
  dimension_type              VARCHAR(20) NOT NULL CHECK (dimension_type IN ('faculty', 'department')),
  dimension_id                VARCHAR(128) NOT NULL,
  dimension_name              VARCHAR(255) NOT NULL,

  total_students              INTEGER NOT NULL DEFAULT 0,
  alerted_students            INTEGER NOT NULL DEFAULT 0,
  critical_alerted_students   INTEGER NOT NULL DEFAULT 0,
  intervened_students         INTEGER NOT NULL DEFAULT 0,
  critical_intervened_students INTEGER NOT NULL DEFAULT 0,
  referred_students           INTEGER NOT NULL DEFAULT 0,
  wellbeing_linked_students   INTEGER NOT NULL DEFAULT 0,
  recovered_students          INTEGER NOT NULL DEFAULT 0,
  repeat_alert_students       INTEGER NOT NULL DEFAULT 0,
  stale_interventions         INTEGER NOT NULL DEFAULT 0,
  open_interventions          INTEGER NOT NULL DEFAULT 0,

  intervention_coverage_pct   NUMERIC(5,2),
  critical_coverage_pct       NUMERIC(5,2),
  median_days_to_contact      NUMERIC(6,2),
  stale_intervention_pct      NUMERIC(5,2),
  referral_rate_pct           NUMERIC(5,2),
  wellbeing_uptake_pct        NUMERIC(5,2),
  alert_recovery_pct          NUMERIC(5,2),
  repeat_alert_pct            NUMERIC(5,2),
  attendance_posting_pct      NUMERIC(5,2),

  response_score              NUMERIC(5,2) NOT NULL DEFAULT 0,
  wellbeing_score             NUMERIC(5,2) NOT NULL DEFAULT 0,
  outcome_score               NUMERIC(5,2) NOT NULL DEFAULT 0,
  readiness_score             NUMERIC(5,2) NOT NULL DEFAULT 0,

  fei_score                   NUMERIC(5,2) NOT NULL DEFAULT 0,
  fei_rating                  VARCHAR(2) NOT NULL DEFAULT 'E',

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (snapshot_date, dimension_type, dimension_id)
);

CREATE INDEX IF NOT EXISTS idx_effectiveness_snapshot_date
  ON effectiveness_scores_by_dimension (snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_effectiveness_type_dim
  ON effectiveness_scores_by_dimension (dimension_type, dimension_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_effectiveness_fei_rating
  ON effectiveness_scores_by_dimension (snapshot_date, fei_rating);
