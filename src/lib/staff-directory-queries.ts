import { pool } from "@/lib/db";

export type StaffListRow = {
  id: string;
  pernr: string;
  name: string;
  img: string | null;
  email: string;
  role:
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor"
    | "wellbeing"
    | "wellbeing-head"
    | "wellbeing-counseller";
  actual_role:
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor"
    | "wellbeing"
    | "wellbeing-head"
    | "wellbeing-counseller"
    | "coordinator"
    | "admin"
    | null;
  pseudo_role:
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor"
    | "wellbeing"
    | "wellbeing-head"
    | "wellbeing-counseller"
    | null;
  faculty_id: string | null;
  faculty_name: string | null;
  other_faculty_names: string[] | null;
  department_names: string[] | null;
  department_ids: string[] | null;
  login_count: number | null;
  last_login_at: string | null;
};

export type FacultyRow = {
  id: string;
  name: string;
};

export type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  faculty_id: string | null;
};

/**
 * Staff directory rows. When `facultyId` is set, only staff whose parent faculty matches.
 * When `excludeSuperadmin` is true, omit anyone with superadmin role/pseudo/actual (dean faculty view).
 */
export async function queryStaffList(options?: {
  facultyId?: string | null;
  excludeSuperadmin?: boolean;
}): Promise<StaffListRow[]> {
  if (!pool) return [];
  const facultyId = options?.facultyId ?? null;
  const excludeSuperadmin = options?.excludeSuperadmin ?? false;

  const excludeSuperadminSql = excludeSuperadmin
    ? ` AND NOT (
          s.role = 'superadmin'
          OR s.pseudo_role = 'superadmin'
          OR s.actual_role = 'superadmin'
        )`
    : "";

  const res = await pool.query<StaffListRow>(
    `WITH enrollment_instructor_faculties AS (
       SELECT DISTINCT
         TRIM(BOTH FROM e.instructor_pernr) AS pernr_key,
         e.faculty_id,
         fac.name AS faculty_name
       FROM student_enrollment_current e
       INNER JOIN faculties fac ON fac.id = e.faculty_id
       WHERE e.is_active = TRUE
         AND e.instructor_pernr IS NOT NULL
         AND TRIM(BOTH FROM e.instructor_pernr) <> ''
         AND e.faculty_id IS NOT NULL
     ),
     enrollment_faculties_by_pernr AS (
       SELECT
         pernr_key,
         ARRAY_AGG(faculty_name ORDER BY faculty_name) AS faculty_names,
         ARRAY_AGG(faculty_id ORDER BY faculty_name) AS faculty_ids
       FROM enrollment_instructor_faculties
       GROUP BY pernr_key
     ),
     enrollment_instructor_departments AS (
       SELECT DISTINCT
         TRIM(BOTH FROM e.instructor_pernr) AS pernr_key,
         e.department_id,
         d.name AS department_name
       FROM student_enrollment_current e
       INNER JOIN departments d ON d.id = e.department_id
       WHERE e.is_active = TRUE
         AND e.instructor_pernr IS NOT NULL
         AND TRIM(BOTH FROM e.instructor_pernr) <> ''
         AND e.department_id IS NOT NULL
     ),
     enrollment_departments_by_pernr AS (
       SELECT
         pernr_key,
         ARRAY_AGG(department_name ORDER BY department_name) AS department_names,
         ARRAY_AGG(department_id ORDER BY department_name) AS department_ids
       FROM enrollment_instructor_departments
       GROUP BY pernr_key
     ),
     staff_departments_by_staff AS (
       SELECT
         sd.staff_id,
         ARRAY_AGG(d.name ORDER BY d.name) AS department_names,
         ARRAY_AGG(d.id ORDER BY d.name) AS department_ids
       FROM staff_departments sd
       INNER JOIN departments d ON d.id = sd.department_id
       GROUP BY sd.staff_id
     )
     SELECT
       s.id,
       s.pernr,
       s.name,
       s.img,
       s.email,
       s.role,
       s.actual_role,
       s.pseudo_role,
       s.faculty_id,
       f.name AS faculty_name,
       COALESCE(
         (
           SELECT ARRAY_AGG(u.faculty_name ORDER BY u.faculty_name)
           FROM unnest(
             COALESCE(ebp.faculty_names, ARRAY[]::text[]),
             COALESCE(ebp.faculty_ids, ARRAY[]::varchar[])
           ) AS u(faculty_name, faculty_id)
           WHERE s.faculty_id IS NULL OR u.faculty_id IS DISTINCT FROM s.faculty_id
         ),
         ARRAY[]::text[]
       ) AS other_faculty_names,
       COALESCE(
         (
           SELECT ARRAY_AGG(x.name ORDER BY x.name)
           FROM (
             SELECT unnest(COALESCE(sdp.department_names, ARRAY[]::text[])) AS name
             UNION
             SELECT unnest(COALESCE(edp.department_names, ARRAY[]::text[])) AS name
           ) AS x
           WHERE x.name IS NOT NULL AND TRIM(x.name) <> ''
         ),
         ARRAY[]::text[]
       ) AS department_names,
       COALESCE(
         (
           SELECT ARRAY_AGG(x.id ORDER BY x.id)
           FROM (
             SELECT unnest(COALESCE(sdp.department_ids, ARRAY[]::varchar[])) AS id
             UNION
             SELECT unnest(COALESCE(edp.department_ids, ARRAY[]::varchar[])) AS id
           ) AS x
           WHERE x.id IS NOT NULL AND TRIM(x.id) <> ''
         ),
         ARRAY[]::varchar[]
       ) AS department_ids,
       s.login_count,
       s.last_login_at::text AS last_login_at
     FROM staff s
     LEFT JOIN faculties f ON f.id = s.faculty_id
     LEFT JOIN enrollment_faculties_by_pernr ebp
       ON ebp.pernr_key = TRIM(BOTH FROM s.pernr)
     LEFT JOIN enrollment_departments_by_pernr edp
       ON edp.pernr_key = TRIM(BOTH FROM s.pernr)
     LEFT JOIN staff_departments_by_staff sdp ON sdp.staff_id = s.id
     WHERE ($1::varchar IS NULL OR s.faculty_id = $1::varchar) ${excludeSuperadminSql}
     ORDER BY s.role ASC, s.name ASC`,
    [facultyId]
  );

  return res.rows;
}

export async function queryFaculties(): Promise<FacultyRow[]> {
  if (!pool) return [];
  const res = await pool.query<FacultyRow>(
    `SELECT id, name FROM faculties ORDER BY name ASC`
  );
  return res.rows;
}

export async function queryDepartments(): Promise<DepartmentRow[]> {
  if (!pool) return [];
  const res = await pool.query<DepartmentRow>(
    `SELECT id, name, code, faculty_id
     FROM departments
     ORDER BY name ASC`
  );
  return res.rows;
}

export type ProgramRow = {
  id: string;
  title: string;
  faculty_id: string | null;
  department_id: string | null;
};

export type CourseRow = {
  id: string;
  title: string | null;
  faculty_id: string | null;
  department_id: string | null;
  program_id: string | null;
};

export async function queryPrograms(): Promise<ProgramRow[]> {
  if (!pool) return [];
  const res = await pool.query<ProgramRow>(
    `SELECT id, title, faculty_id, department_id
     FROM programs
     ORDER BY title ASC`
  );
  return res.rows;
}

export async function queryCourses(): Promise<CourseRow[]> {
  if (!pool) return [];
  const res = await pool.query<CourseRow>(
    `SELECT id, title, faculty_id, department_id, program_id
     FROM courses
     ORDER BY title ASC NULLS LAST, id ASC`
  );
  return res.rows;
}
