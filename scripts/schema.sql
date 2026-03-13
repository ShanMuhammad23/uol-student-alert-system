-- =============================================================================
-- Student Alert System – Role-based access (Dean, HoD, Instructor)
-- IDs align with enrollment_data.json: FacId, DeptId/DeptCode, CrCode, Pernr
-- =============================================================================

-- Faculties (id = FacId from enrollment_data.json)
CREATE TABLE IF NOT EXISTS faculties (
  id          VARCHAR(32) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Departments (id = DeptId from enrollment; code = DeptCode for display/lookup)
CREATE TABLE IF NOT EXISTS departments (
  id          VARCHAR(32) PRIMARY KEY,
  code        VARCHAR(32),
  name        VARCHAR(255) NOT NULL,
  faculty_id  VARCHAR(32) NOT NULL REFERENCES faculties(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_faculty_id ON departments(faculty_id);

-- Staff: one row per user (Dean, HoD, or Instructor)
-- For Instructors: pernr matches enrollment_data.json "Pernr" (teacher employee number)
CREATE TABLE IF NOT EXISTS staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pernr         VARCHAR(32) UNIQUE NOT NULL,  -- Employee number; for instructors matches enrollment_data.json Pernr
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  role          VARCHAR(20) NOT NULL CHECK (role IN ('dean', 'hod', 'instructor')),
  faculty_id    VARCHAR(32) REFERENCES faculties(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  img           TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_faculty_id ON staff(faculty_id);
CREATE INDEX IF NOT EXISTS idx_staff_pernr ON staff(pernr);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

-- HoD: which departments this staff member heads (only used when role = 'hod')
CREATE TABLE IF NOT EXISTS staff_departments (
  staff_id       UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  department_id  VARCHAR(32) NOT NULL REFERENCES departments(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (staff_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_departments_staff_id ON staff_departments(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_departments_department_id ON staff_departments(department_id);

-- Optional: courses reference for lookup (course codes from enrollment_data CrCode)
CREATE TABLE IF NOT EXISTS courses (
  id             VARCHAR(64) PRIMARY KEY,
  title          VARCHAR(255),
  department_id  VARCHAR(32) REFERENCES departments(id),
  faculty_id     VARCHAR(32) REFERENCES faculties(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Seed: 1 Faculty, 1 Department (from enrollment_data.json sample)
-- =============================================================================

INSERT INTO faculties (id, name) VALUES
  ('50000172', 'Faculty of Social Sciences')
ON CONFLICT (id) DO NOTHING;

INSERT INTO departments (id, code, name, faculty_id) VALUES
  ('51517449', '111708', 'Department of Criminology', '50000172')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Seed: 1 user per role (Dean, HoD, Instructor)
-- =============================================================================

-- 1) Dean – faculty_id = 50000172 (Faculty of Social Sciences)
INSERT INTO staff (id, pernr, name, email, password_hash, role, faculty_id) VALUES
  ('a0000001-0000-4000-8000-000000000001', '900001', 'Prof. Dr. Rabia Akhtar', 'dean@uol.edu.pk', '$2a$10$placeholder_hash_replace_in_app', 'dean', '50000172')
ON CONFLICT (email) DO UPDATE SET
  pernr = EXCLUDED.pernr,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  faculty_id = EXCLUDED.faculty_id,
  updated_at = NOW();

-- 2) HoD – heads Department of Criminology (51517449)
INSERT INTO staff (id, pernr, name, email, password_hash, role, faculty_id) VALUES
  ('a0000001-0000-4000-8000-000000000002', '900002', 'Dr. Sara Khan', 'hod.criminology@uol.edu.pk', '$2a$10$placeholder_hash_replace_in_app', 'hod', NULL)
ON CONFLICT (email) DO UPDATE SET
  pernr = EXCLUDED.pernr,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  updated_at = NOW();

INSERT INTO staff_departments (staff_id, department_id)
SELECT s.id, '51517449'
FROM staff s
WHERE s.email = 'hod.criminology@uol.edu.pk'
ON CONFLICT (staff_id, department_id) DO NOTHING;

-- 3) Instructor – pernr matches enrollment_data.json Teacher "Maleeha Amjad" (Pernr 00016932)
INSERT INTO staff (id, pernr, name, email, password_hash, role, faculty_id) VALUES
  ('a0000001-0000-4000-8000-000000000003', '00016932', 'Maleeha Amjad', 'maleeha.amjad@law.uol.edu.pk', '$2a$10$placeholder_hash_replace_in_app', 'instructor', '50000172')
ON CONFLICT (email) DO UPDATE SET
  pernr = EXCLUDED.pernr,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  faculty_id = EXCLUDED.faculty_id,
  updated_at = NOW();


  CREATE TABLE interventions (
    id              VARCHAR(64) PRIMARY KEY,          -- e.g. "int-1771910179731-cld7bky"
    student_sap_id  VARCHAR(32) NOT NULL,             -- e.g. "100033"
    date            DATE NOT NULL,                    -- "2026-02-24"
    outreach_mode   VARCHAR(32) NOT NULL,             -- e.g. "email", "phone-call", "meeting", "flagged"
    remarks         TEXT NOT NULL DEFAULT '',         -- free-text remarks
    status          VARCHAR(32) NOT NULL,             -- e.g. "initiated", "in-progress", "referred"
    performed_at    TIMESTAMPTZ NOT NULL,             -- ISO timestamp string
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    department_id   VARCHAR(32) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    course_id       VARCHAR(64) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    faculty_id      VARCHAR(32) NOT NULL REFERENCES faculties(id) ON DELETE CASCADE
  );

  -- Helpful indexes
  CREATE INDEX idx_interventions_student_sap_id ON interventions(student_sap_id);
  CREATE INDEX idx_interventions_status ON interventions(status);
  CREATE INDEX idx_interventions_performed_at ON interventions(performed_at);
  CREATE INDEX idx_interventions_staff_id ON interventions(staff_id);
  CREATE INDEX idx_interventions_department_id ON interventions(department_id);
  CREATE INDEX idx_interventions_course_id ON interventions(course_id);
  CREATE INDEX idx_interventions_faculty_id ON interventions(faculty_id);
  
  CREATE TABLE wellbeing_cases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_sap_id   VARCHAR(32) NOT NULL,   -- e.g. SAP id from students/enrollment
  category         VARCHAR(32) NOT NULL,   -- 'Counselling', 'Monitoring', 'Flex (Academic)', 'Flex (Financial)'
  wellbeing_status VARCHAR(32) NOT NULL,   -- e.g. 'open', 'in-progress', 'closed'
  remarks          TEXT NOT NULL DEFAULT '',
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,           -- when resolution_status becomes 'resolved'
  staff_id UUID REFERENCES staff(id)  -- who initiated the case (optional FK)
);

-- Optional: constrain categories and statuses to known values
ALTER TABLE wellbeing_cases
  ADD CONSTRAINT chk_wellbeing_category
  CHECK (category IN ('Counselling', 'Monitoring', 'Flex (Academic)', 'Flex (Financial)'));

ALTER TABLE wellbeing_cases
  ADD CONSTRAINT chk_wellbeing_status
  CHECK (wellbeing_status IN ('open',  'closed'));

-- Helpful indexes for charts and filters
CREATE INDEX idx_wellbeing_cases_student ON wellbeing_cases(student_sap_id);
CREATE INDEX idx_wellbeing_cases_category ON wellbeing_cases(category);
CREATE INDEX idx_wellbeing_cases_resolution_status ON wellbeing_cases(resolution_status);
-- =============================================================================
-- Notes
-- =============================================================================
-- - Dean: dashboard filtered by staff.faculty_id = FacId in enrollment_data.
-- - HoD: dashboard filtered by enrollment DeptId IN (staff_departments.department_id).
-- - Instructor: dashboard filtered by enrollment Pernr = staff.pernr.
-- - Replace password_hash with real bcrypt hash: run `node scripts/hash-password.js demo123` and UPDATE staff SET password_hash = '<hash>' WHERE email = '...';
-- - Add more faculties/departments by parsing enrollment_data.json (distinct FacId, DeptId, DeptName, DeptCode).
