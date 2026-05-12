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
 */
export async function queryStaffList(options?: {
  facultyId?: string | null;
}): Promise<StaffListRow[]> {
  if (!pool) return [];
  const facultyId = options?.facultyId ?? null;

  const res = await pool.query<StaffListRow>(
    `SELECT
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
             SELECT DISTINCT fac.name AS faculty_name
             FROM student_enrollment_current e
             INNER JOIN faculties fac ON fac.id = e.faculty_id
             WHERE e.is_active = TRUE
               AND e.instructor_pernr IS NOT NULL
               AND TRIM(e.instructor_pernr) <> ''
               AND TRIM(e.instructor_pernr) = TRIM(s.pernr)
               AND e.faculty_id IS NOT NULL
               AND (s.faculty_id IS NULL OR e.faculty_id IS DISTINCT FROM s.faculty_id)
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
       s.last_login_at::text AS last_login_at
     FROM staff s
     LEFT JOIN faculties f ON f.id = s.faculty_id
     LEFT JOIN staff_departments sd ON sd.staff_id = s.id
     LEFT JOIN departments d ON d.id = sd.department_id
     WHERE ($1::varchar IS NULL OR s.faculty_id = $1::varchar)
     GROUP BY s.id, s.pernr, s.name, s.img, s.email, s.role, s.actual_role, s.pseudo_role, s.faculty_id, f.name, s.login_count, s.last_login_at
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
