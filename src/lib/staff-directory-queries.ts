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

export const UNREGISTERED_STAFF_PAGE_SIZE = 100;

export type UnregisteredStaffListResult = {
  rows: StaffListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Instructors present in active enrollment but not registered in the staff table.
 */
export async function queryUnregisteredStaffList(options?: {
  page?: number;
  pageSize?: number;
  facultyId?: string | null;
  departmentId?: string | null;
  search?: string | null;
}): Promise<UnregisteredStaffListResult> {
  const pageSize = options?.pageSize ?? UNREGISTERED_STAFF_PAGE_SIZE;
  const page = Math.max(1, Number(options?.page ?? 1) || 1);
  const facultyId = options?.facultyId?.trim() || null;
  const departmentId = options?.departmentId?.trim() || null;
  const search = options?.search?.trim() || null;

  if (!pool) {
    return { rows: [], total: 0, page: 1, pageSize, totalPages: 1 };
  }

  const params: unknown[] = [];
  let paramIdx = 1;

  const pushParam = (value: unknown) => {
    params.push(value);
    return `$${paramIdx++}`;
  };

  const facultyParam = pushParam(facultyId);
  const departmentParam = pushParam(departmentId);
  const searchParam = pushParam(search ? `%${search}%` : null);

  const filterSql = `
    AND (
      ${facultyParam}::varchar IS NULL
      OR EXISTS (
        SELECT 1
        FROM student_enrollment_current ef
        WHERE ef.is_active = TRUE
          AND ef.instructor_pernr IS NOT NULL
          AND TRIM(BOTH FROM ef.instructor_pernr) = u.pernr_key
          AND ef.faculty_id = ${facultyParam}::varchar
      )
    )
    AND (
      ${departmentParam}::varchar IS NULL
      OR EXISTS (
        SELECT 1
        FROM student_enrollment_current ed
        WHERE ed.is_active = TRUE
          AND ed.instructor_pernr IS NOT NULL
          AND TRIM(BOTH FROM ed.instructor_pernr) = u.pernr_key
          AND ed.department_id = ${departmentParam}::varchar
      )
    )
    AND (
      ${searchParam}::text IS NULL
      OR u.name ILIKE ${searchParam}::text
      OR u.email ILIKE ${searchParam}::text
      OR u.pernr_key ILIKE ${searchParam}::text
    )`;

  const baseCte = `
    WITH enrollment_instructor_faculties AS (
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
    enrollment_instructors AS (
      SELECT
        TRIM(BOTH FROM e.instructor_pernr) AS pernr_key,
        NULLIF(TRIM(MAX(e.instructor_name)), '') AS name,
        COALESCE(NULLIF(TRIM(LOWER(MAX(e.instructor_email))), ''), '') AS email
      FROM student_enrollment_current e
      WHERE e.is_active = TRUE
        AND e.instructor_pernr IS NOT NULL
        AND TRIM(BOTH FROM e.instructor_pernr) <> ''
      GROUP BY TRIM(BOTH FROM e.instructor_pernr)
    ),
    unregistered AS (
      SELECT ei.pernr_key, ei.name, ei.email
      FROM enrollment_instructors ei
      WHERE NOT EXISTS (
        SELECT 1
        FROM staff s
        WHERE TRIM(BOTH FROM s.pernr) = ei.pernr_key
      )
    ),
    primary_faculty_by_pernr AS (
      SELECT DISTINCT ON (eif.pernr_key)
        eif.pernr_key,
        eif.faculty_id,
        eif.faculty_name
      FROM enrollment_instructor_faculties eif
      ORDER BY eif.pernr_key, eif.faculty_name ASC
    )`;

  type CountRow = { total: string };
  const countRes = await pool.query<CountRow>(
    `${baseCte}
     SELECT COUNT(*)::text AS total
     FROM unregistered u
     WHERE TRUE ${filterSql}`,
    params
  );
  const total = Number(countRes.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const limitParam = pushParam(pageSize);
  const offsetParam = pushParam(offset);

  type UnregisteredRow = {
    id: string;
    pernr: string;
    name: string;
    img: null;
    email: string;
    role: StaffListRow["role"];
    actual_role: null;
    pseudo_role: null;
    faculty_id: string | null;
    faculty_name: string | null;
    other_faculty_names: string[] | null;
    department_names: string[] | null;
    department_ids: string[] | null;
    login_count: null;
    last_login_at: null;
  };

  const listRes = await pool.query<UnregisteredRow>(
    `${baseCte}
     SELECT
       ('unregistered:' || u.pernr_key) AS id,
       u.pernr_key AS pernr,
       COALESCE(u.name, '') AS name,
       NULL::text AS img,
       COALESCE(u.email, '') AS email,
       'instructor'::varchar AS role,
       NULL::varchar AS actual_role,
       NULL::varchar AS pseudo_role,
       pf.faculty_id,
       pf.faculty_name,
       COALESCE(
         (
           SELECT ARRAY_AGG(other.faculty_name ORDER BY other.faculty_name)
           FROM unnest(
             COALESCE(ebp.faculty_names, ARRAY[]::text[]),
             COALESCE(ebp.faculty_ids, ARRAY[]::varchar[])
           ) AS other(faculty_name, faculty_id)
           WHERE pf.faculty_id IS NULL OR other.faculty_id IS DISTINCT FROM pf.faculty_id
         ),
         ARRAY[]::text[]
       ) AS other_faculty_names,
       COALESCE(edp.department_names, ARRAY[]::text[]) AS department_names,
       COALESCE(edp.department_ids, ARRAY[]::varchar[]) AS department_ids,
       NULL::int AS login_count,
       NULL::text AS last_login_at
     FROM unregistered u
     LEFT JOIN primary_faculty_by_pernr pf ON pf.pernr_key = u.pernr_key
     LEFT JOIN enrollment_faculties_by_pernr ebp ON ebp.pernr_key = u.pernr_key
     LEFT JOIN enrollment_departments_by_pernr edp ON edp.pernr_key = u.pernr_key
     WHERE TRUE ${filterSql}
     ORDER BY COALESCE(u.name, u.pernr_key) ASC, u.pernr_key ASC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params
  );

  return {
    rows: listRes.rows,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
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
