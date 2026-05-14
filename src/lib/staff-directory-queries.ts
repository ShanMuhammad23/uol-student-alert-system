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
  /** True when a password hash exists (plaintext is never stored or returned). */
  has_password: boolean;
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
           SELECT ARRAY_AGG(sub.faculty_name ORDER BY sub.faculty_name)
           FROM (
             SELECT DISTINCT eif.faculty_name
             FROM enrollment_instructor_faculties eif
             WHERE eif.pernr_key = TRIM(BOTH FROM s.pernr)
               AND (s.faculty_id IS NULL OR eif.faculty_id IS DISTINCT FROM s.faculty_id)
           ) AS sub
         ),
         ARRAY[]::text[]
       ) AS other_faculty_names,
       COALESCE(
         ARRAY_AGG(DISTINCT d.name) FILTER (WHERE d.name IS NOT NULL),
         ARRAY[]::text[]
       ) AS department_names,
       COALESCE(
         ARRAY_AGG(DISTINCT d.id) FILTER (WHERE d.id IS NOT NULL),
         ARRAY[]::varchar[]
       ) AS department_ids,
       s.login_count,
       s.last_login_at::text AS last_login_at,
       (s.password_hash IS NOT NULL AND TRIM(COALESCE(s.password_hash, '')) <> '') AS has_password
     FROM staff s
     LEFT JOIN faculties f ON f.id = s.faculty_id
     LEFT JOIN staff_departments sd ON sd.staff_id = s.id
     LEFT JOIN departments d ON d.id = sd.department_id
     WHERE ($1::varchar IS NULL OR s.faculty_id = $1::varchar) ${excludeSuperadminSql}
     GROUP BY s.id, s.pernr, s.name, s.img, s.email, s.role, s.actual_role, s.pseudo_role, s.faculty_id, f.name, s.login_count, s.last_login_at, s.password_hash
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
