-- =============================================================================
-- Student Alert System - Scalable DB-first schema (PostgreSQL)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) MASTER DIMENSIONS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS faculties (
  id           VARCHAR(32) PRIMARY KEY,       -- FacId
  name         VARCHAR(255) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id           VARCHAR(32) PRIMARY KEY,       -- DeptId
  code         VARCHAR(32),                   -- DeptCode
  name         VARCHAR(255) NOT NULL,
  faculty_id   VARCHAR(32) NOT NULL REFERENCES faculties(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_departments_faculty_id ON departments(faculty_id);
CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);

CREATE TABLE IF NOT EXISTS programs (
  id             VARCHAR(32) PRIMARY KEY,     -- DegreeCode / derived
  title          VARCHAR(255) NOT NULL,
  faculty_id     VARCHAR(32) REFERENCES faculties(id),
  department_id  VARCHAR(32) REFERENCES departments(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_programs_faculty_id ON programs(faculty_id);
CREATE INDEX IF NOT EXISTS idx_programs_department_id ON programs(department_id);

CREATE TABLE IF NOT EXISTS courses (
  id             VARCHAR(64) PRIMARY KEY,     -- CrCode
  title          VARCHAR(255),
  department_id  VARCHAR(32) REFERENCES departments(id),
  faculty_id     VARCHAR(32) REFERENCES faculties(id),
  program_id     VARCHAR(32) REFERENCES programs(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_courses_department_id ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_faculty_id ON courses(faculty_id);
CREATE INDEX IF NOT EXISTS idx_courses_program_id ON courses(program_id);

-- -----------------------------------------------------------------------------
-- 2) STAFF + ACCESS SCOPE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pernr         VARCHAR(32) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role          VARCHAR(32) NOT NULL CHECK (role IN ('superadmin', 'dean', 'hod', 'instructor', 'wellbeing', 'wellbeing-head', 'wellbeing-counseller')),
  actual_role   VARCHAR(32) NOT NULL DEFAULT 'instructor' CHECK (actual_role IN ('superadmin', 'dean', 'hod', 'instructor', 'wellbeing', 'wellbeing-head', 'wellbeing-counseller', 'coordinator', 'admin')),
  pseudo_role   VARCHAR(32) CHECK (pseudo_role IN ('superadmin', 'dean', 'hod', 'instructor', 'wellbeing', 'wellbeing-head', 'wellbeing-counseller')),
  faculty_id    VARCHAR(32) REFERENCES faculties(id),
  img           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS actual_role VARCHAR(32) NOT NULL DEFAULT 'instructor';
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS pseudo_role VARCHAR(32);
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_actual_role_check;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_pseudo_role_check;
UPDATE staff
SET pseudo_role = role
WHERE pseudo_role IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staff_actual_role_check'
  ) THEN
    ALTER TABLE staff
      ADD CONSTRAINT staff_actual_role_check
      CHECK (actual_role IN ('superadmin', 'dean', 'hod', 'instructor', 'wellbeing', 'wellbeing-head', 'wellbeing-counseller', 'coordinator', 'admin'));
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staff_pseudo_role_check'
  ) THEN
    ALTER TABLE staff
      ADD CONSTRAINT staff_pseudo_role_check
      CHECK (pseudo_role IN ('superadmin', 'dean', 'hod', 'instructor', 'wellbeing', 'wellbeing-head', 'wellbeing-counseller'));
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_actual_role ON staff(actual_role);
CREATE INDEX IF NOT EXISTS idx_staff_pseudo_role ON staff(pseudo_role);
CREATE INDEX IF NOT EXISTS idx_staff_faculty_id ON staff(faculty_id);
CREATE INDEX IF NOT EXISTS idx_staff_pernr ON staff(pernr);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

CREATE TABLE IF NOT EXISTS staff_departments (
  staff_id      UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  department_id VARCHAR(32) NOT NULL REFERENCES departments(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, department_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_departments_staff_id ON staff_departments(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_departments_department_id ON staff_departments(department_id);

-- Instructor-course mapping
CREATE TABLE IF NOT EXISTS instructor_courses (
  instructor_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  course_id     VARCHAR(64) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_code  VARCHAR(32) NOT NULL DEFAULT '',
  source_pernr  VARCHAR(32),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (instructor_id, course_id, section_code)
);
CREATE INDEX IF NOT EXISTS idx_instructor_courses_course_id ON instructor_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_instructor_courses_source_pernr ON instructor_courses(source_pernr);

-- -----------------------------------------------------------------------------
-- 3) STUDENTS + CURRENT ENROLLMENT (listing source of truth)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS students (
  sap_id       VARCHAR(32) PRIMARY KEY,
  full_name    VARCHAR(255),
  gender       VARCHAR(16),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per student-course-section-package (current window)
CREATE TABLE IF NOT EXISTS student_enrollment_current (
  sap_id            VARCHAR(32) NOT NULL REFERENCES students(sap_id) ON DELETE CASCADE,
  student_name      VARCHAR(255),
  faculty_id        VARCHAR(32) NOT NULL REFERENCES faculties(id),
  department_id     VARCHAR(32) NOT NULL REFERENCES departments(id),
  program_id        VARCHAR(32) REFERENCES programs(id),
  course_id         VARCHAR(64) NOT NULL REFERENCES courses(id),
  section_code      VARCHAR(32) NOT NULL DEFAULT '',
  event_package_id  VARCHAR(64) NOT NULL DEFAULT '',
  instructor_pernr  VARCHAR(32),
  instructor_name   VARCHAR(255),
  term_year         VARCHAR(8),
  term_session      VARCHAR(8),
  admission_year    VARCHAR(8),
  admission_period_id VARCHAR(8),
  admission_session VARCHAR(16),
  campus_code       VARCHAR(16),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  snapshot_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sap_id, course_id, section_code, event_package_id)
);

CREATE INDEX IF NOT EXISTS idx_enroll_current_faculty ON student_enrollment_current(faculty_id, sap_id);
CREATE INDEX IF NOT EXISTS idx_enroll_current_department ON student_enrollment_current(department_id, sap_id);
CREATE INDEX IF NOT EXISTS idx_enroll_current_program ON student_enrollment_current(program_id, sap_id);
CREATE INDEX IF NOT EXISTS idx_enroll_current_course ON student_enrollment_current(course_id, sap_id);
CREATE INDEX IF NOT EXISTS idx_enroll_current_instructor ON student_enrollment_current(instructor_pernr, sap_id);
CREATE INDEX IF NOT EXISTS idx_enroll_current_term ON student_enrollment_current(term_year, term_session, campus_code);
CREATE INDEX IF NOT EXISTS idx_enroll_current_admission ON student_enrollment_current(admission_year, admission_period_id, admission_session);
CREATE INDEX IF NOT EXISTS idx_enroll_current_name ON student_enrollment_current(student_name);
CREATE INDEX IF NOT EXISTS idx_enroll_current_active ON student_enrollment_current(is_active);

-- -----------------------------------------------------------------------------
-- 4) STUDENT GPA PROFILES (semester-wise CGPA + SGPA history)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS student_gpa_profiles (
  sap_id          VARCHAR(32) PRIMARY KEY REFERENCES students(sap_id) ON DELETE CASCADE,
  department_id   VARCHAR(32),
  course_id       VARCHAR(64),
  faculty_id      VARCHAR(32),
  cgpa_fall_2025  NUMERIC(4,2),
  cgpa_semesters  JSONB NOT NULL DEFAULT '{}'::jsonb,
  sgpa_semesters  JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_year     VARCHAR(4),
  source_term     VARCHAR(3),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_gpa_profiles_faculty_id ON student_gpa_profiles(faculty_id);
CREATE INDEX IF NOT EXISTS idx_student_gpa_profiles_department_id ON student_gpa_profiles(department_id);

-- -----------------------------------------------------------------------------
-- 5) CURRENT ALERT FACTS (for consistent table + cards behavior)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS student_alert_current (
  sap_id                    VARCHAR(32) NOT NULL REFERENCES students(sap_id) ON DELETE CASCADE,
  course_id                 VARCHAR(64) NOT NULL REFERENCES courses(id),
  section_code              VARCHAR(32) NOT NULL DEFAULT '',
  event_package_id          VARCHAR(64) NOT NULL DEFAULT '',

  faculty_id                VARCHAR(32) NOT NULL REFERENCES faculties(id),
  department_id             VARCHAR(32) NOT NULL REFERENCES departments(id),
  program_id                VARCHAR(32) REFERENCES programs(id),
  instructor_pernr          VARCHAR(32),

  total_classes_held        INTEGER NOT NULL DEFAULT 0,
  attendance_marked_classes INTEGER NOT NULL DEFAULT 0, -- monitoring Att
  attendance_not_updated_classes INTEGER NOT NULL DEFAULT 0, -- GREATEST(Held - Att, 0)
  classes_attended          INTEGER NOT NULL DEFAULT 0,
  attendance_percentage     NUMERIC(5,2),
  class_average_attendance  NUMERIC(5,2),
  attendance_deviation      NUMERIC(6,2),  -- class_avg - student_pct

  gpa_current               NUMERIC(4,2),
  gpa_previous              NUMERIC(4,2),
  gpa_change                NUMERIC(5,2),

  attendance_alert_level    VARCHAR(16) CHECK (attendance_alert_level IN ('warning', 'critical') OR attendance_alert_level IS NULL),
  gpa_alert_level           VARCHAR(16) CHECK (gpa_alert_level IN ('warning', 'critical') OR gpa_alert_level IS NULL),
  overall_alert_level       VARCHAR(16) NOT NULL CHECK (overall_alert_level IN ('none', 'warning', 'critical')),

  computed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  etl_run_id                BIGINT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (sap_id, course_id, section_code, event_package_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_current_faculty_alert
  ON student_alert_current(faculty_id, overall_alert_level, sap_id);

CREATE INDEX IF NOT EXISTS idx_alert_current_department_alert
  ON student_alert_current(department_id, overall_alert_level, sap_id);

CREATE INDEX IF NOT EXISTS idx_alert_current_program_alert
  ON student_alert_current(program_id, overall_alert_level, sap_id);

CREATE INDEX IF NOT EXISTS idx_alert_current_course_alert
  ON student_alert_current(course_id, overall_alert_level, sap_id);

CREATE INDEX IF NOT EXISTS idx_alert_current_instructor_alert
  ON student_alert_current(instructor_pernr, overall_alert_level, sap_id);

CREATE INDEX IF NOT EXISTS idx_alert_current_gpa_level
  ON student_alert_current(gpa_alert_level);

CREATE INDEX IF NOT EXISTS idx_alert_current_attendance_level
  ON student_alert_current(attendance_alert_level);

-- -----------------------------------------------------------------------------
-- 6) DAILY SNAPSHOT AGGREGATES (used by dashboard cards/charts)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS alert_counts_by_dimension (
  snapshot_date      DATE NOT NULL,
  dimension_type     VARCHAR(20) NOT NULL CHECK (dimension_type IN ('faculty', 'department', 'program', 'course', 'instructor')),
  dimension_id       VARCHAR(128) NOT NULL,
  dimension_name     VARCHAR(255) NOT NULL,
  total_students     INTEGER NOT NULL DEFAULT 0,
  yellow_gpa         INTEGER NOT NULL DEFAULT 0,
  red_gpa            INTEGER NOT NULL DEFAULT 0,
  yellow_attendance  INTEGER NOT NULL DEFAULT 0,
  red_attendance     INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (snapshot_date, dimension_type, dimension_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_counts_date ON alert_counts_by_dimension(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_alert_counts_type_date ON alert_counts_by_dimension(dimension_type, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_alert_counts_type_dim ON alert_counts_by_dimension(dimension_type, dimension_id);

-- Optional detailed daily snapshot for audit/backfill/reporting
CREATE TABLE IF NOT EXISTS student_alert_daily (
  snapshot_date             DATE NOT NULL,
  sap_id                    VARCHAR(32) NOT NULL REFERENCES students(sap_id) ON DELETE CASCADE,
  course_id                 VARCHAR(64) NOT NULL REFERENCES courses(id),
  section_code              VARCHAR(32) NOT NULL DEFAULT '',
  event_package_id          VARCHAR(64) NOT NULL DEFAULT '',

  faculty_id                VARCHAR(32) NOT NULL REFERENCES faculties(id),
  department_id             VARCHAR(32) NOT NULL REFERENCES departments(id),
  program_id                VARCHAR(32) REFERENCES programs(id),
  instructor_pernr          VARCHAR(32),

  attendance_alert_level    VARCHAR(16) CHECK (attendance_alert_level IN ('warning', 'critical') OR attendance_alert_level IS NULL),
  gpa_alert_level           VARCHAR(16) CHECK (gpa_alert_level IN ('warning', 'critical') OR gpa_alert_level IS NULL),
  overall_alert_level       VARCHAR(16) NOT NULL CHECK (overall_alert_level IN ('none', 'warning', 'critical')),

  total_classes_held        INTEGER NOT NULL DEFAULT 0,
  attendance_marked_classes INTEGER NOT NULL DEFAULT 0, -- monitoring Att
  attendance_not_updated_classes INTEGER NOT NULL DEFAULT 0, -- GREATEST(Held - Att, 0)
  classes_attended          INTEGER NOT NULL DEFAULT 0,
  attendance_percentage     NUMERIC(5,2),
  class_average_attendance  NUMERIC(5,2),
  gpa_current               NUMERIC(4,2),
  gpa_previous              NUMERIC(4,2),
  gpa_change                NUMERIC(5,2),

  etl_run_id                BIGINT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (snapshot_date, sap_id, course_id, section_code, event_package_id)
);

CREATE INDEX IF NOT EXISTS idx_student_alert_daily_dim
  ON student_alert_daily(snapshot_date, faculty_id, department_id, program_id, course_id, instructor_pernr);

-- -----------------------------------------------------------------------------
-- 7) ETL RUN TRACKING
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS etl_runs (
  id                       BIGSERIAL PRIMARY KEY,
  pipeline_name            VARCHAR(64) NOT NULL,  -- e.g. daily_alert_snapshot
  started_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at             TIMESTAMPTZ,
  status                   VARCHAR(16) NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
  source_rows_enrollment   BIGINT NOT NULL DEFAULT 0,
  source_rows_attendance   BIGINT NOT NULL DEFAULT 0,
  source_rows_monitoring   BIGINT NOT NULL DEFAULT 0,
  produced_rows_current    BIGINT NOT NULL DEFAULT 0,
  produced_rows_daily      BIGINT NOT NULL DEFAULT 0,
  error_message            TEXT
);
CREATE INDEX IF NOT EXISTS idx_etl_runs_pipeline_started ON etl_runs(pipeline_name, started_at DESC);

-- -----------------------------------------------------------------------------
-- 8) INTERVENTIONS + WELLBEING
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS interventions (
  id                 VARCHAR(64) PRIMARY KEY,
  student_sap_id     VARCHAR(32) NOT NULL REFERENCES students(sap_id),
  date               DATE NOT NULL,
  intervention_type  VARCHAR(16) NOT NULL DEFAULT 'attendance' CHECK (intervention_type IN ('attendance', 'gpa')),
  alert_level        VARCHAR(16) CHECK (alert_level IN ('warning', 'critical') OR alert_level IS NULL),
  outreach_mode      VARCHAR(32) NOT NULL,
  remarks            TEXT NOT NULL DEFAULT '',
  status             VARCHAR(32) NOT NULL CHECK (status IN ('initiated', 'in-progress', 'referred', 'resolved')),
  performed_at       TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  staff_id           UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  department_id      VARCHAR(32) REFERENCES departments(id) ON DELETE SET NULL,
  course_id          VARCHAR(64) REFERENCES courses(id) ON DELETE SET NULL,
  faculty_id         VARCHAR(32) REFERENCES faculties(id) ON DELETE SET NULL,
  case_type          VARCHAR(16) NOT NULL DEFAULT 'referred' CHECK (case_type IN ('referred', 'internal', 'external')),
  assignee_staff_id  UUID REFERENCES staff(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_interventions_student_sap_id ON interventions(student_sap_id);
CREATE INDEX IF NOT EXISTS idx_interventions_status ON interventions(status);
CREATE INDEX IF NOT EXISTS idx_interventions_performed_at ON interventions(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_interventions_staff_id ON interventions(staff_id);
CREATE INDEX IF NOT EXISTS idx_interventions_department_id ON interventions(department_id);
CREATE INDEX IF NOT EXISTS idx_interventions_course_id ON interventions(course_id);
CREATE INDEX IF NOT EXISTS idx_interventions_faculty_id ON interventions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_interventions_case_type ON interventions(case_type);
CREATE INDEX IF NOT EXISTS idx_interventions_assignee_staff_id ON interventions(assignee_staff_id);

CREATE TABLE IF NOT EXISTS intervention_emails (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_sap_id   VARCHAR(32) NOT NULL REFERENCES students(sap_id) ON DELETE CASCADE,
  intervention_id  VARCHAR(64) REFERENCES interventions(id) ON DELETE SET NULL,
  template_key     VARCHAR(32) NOT NULL CHECK (template_key IN ('sos_check_in', 'student_referral')),
  recipient_email  VARCHAR(255) NOT NULL,
  subject          TEXT NOT NULL,
  body_html        TEXT NOT NULL,
  sender_staff_id  UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  sender_name      VARCHAR(255),
  sender_email     VARCHAR(255),
  sender_pernr     VARCHAR(32),
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intervention_emails_student_sap_id ON intervention_emails(student_sap_id);
CREATE INDEX IF NOT EXISTS idx_intervention_emails_sent_at ON intervention_emails(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_intervention_emails_sender_staff_id ON intervention_emails(sender_staff_id);

CREATE TABLE IF NOT EXISTS wellbeing_cases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_sap_id   VARCHAR(32) NOT NULL REFERENCES students(sap_id),
  category         VARCHAR(32) NOT NULL CHECK (category IN ('Counselling', 'Monitoring', 'Flex (Academic)', 'Flex (Financial)')),
  wellbeing_status VARCHAR(32) NOT NULL CHECK (wellbeing_status IN ('open', 'closed')),
  remarks          TEXT NOT NULL DEFAULT '',
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  staff_id         UUID REFERENCES staff(id)
);

CREATE INDEX IF NOT EXISTS idx_wellbeing_cases_student ON wellbeing_cases(student_sap_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_cases_category ON wellbeing_cases(category);
CREATE INDEX IF NOT EXISTS idx_wellbeing_cases_status ON wellbeing_cases(wellbeing_status);

-- Direct wellbeing-initiated cases (links to interventions row for unified listing)
CREATE TABLE IF NOT EXISTS wellbeing_direct_cases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_sap_id      VARCHAR(32) NOT NULL REFERENCES students(sap_id) ON DELETE CASCADE,
  intervention_id     VARCHAR(64) NOT NULL UNIQUE REFERENCES interventions(id) ON DELETE CASCADE,
  visit_date          DATE,
  reason_for_visit    TEXT NOT NULL DEFAULT '',
  initial_findings    TEXT NOT NULL DEFAULT '',
  direct_case_status  VARCHAR(32) NOT NULL DEFAULT 'in-progress' CHECK (direct_case_status IN ('initiated', 'in-progress', 'referred', 'resolved', 'no-action-required')),
  external_notes      TEXT NOT NULL DEFAULT '',
  created_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wellbeing_direct_cases
  ADD COLUMN IF NOT EXISTS visit_date DATE;
ALTER TABLE wellbeing_direct_cases
  ADD COLUMN IF NOT EXISTS reason_for_visit TEXT NOT NULL DEFAULT '';
ALTER TABLE wellbeing_direct_cases
  ADD COLUMN IF NOT EXISTS initial_findings TEXT NOT NULL DEFAULT '';
ALTER TABLE wellbeing_direct_cases
  ADD COLUMN IF NOT EXISTS direct_case_status VARCHAR(32) NOT NULL DEFAULT 'in-progress';

CREATE INDEX IF NOT EXISTS idx_wellbeing_direct_cases_student ON wellbeing_direct_cases(student_sap_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_direct_cases_intervention ON wellbeing_direct_cases(intervention_id);

-- =============================================================================
-- End schema
-- =============================================================================