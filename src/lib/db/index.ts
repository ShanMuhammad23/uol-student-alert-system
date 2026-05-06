import { Pool } from "pg";

const globalForDb = globalThis as unknown as { pool: Pool | undefined };

function createPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
  });
}

function getPool(): Pool | null {
  if (globalForDb.pool) return globalForDb.pool;
  const p = createPool();
  if (p && process.env.NODE_ENV !== "production") globalForDb.pool = p;
  return p;
}
export const pool: Pool | null = getPool();

/** Staff row from DB (matches schema.staff + role). */
export type StaffRow = {
  id: string;
  pernr: string;
  name: string;
  email: string;
  password_hash: string | null;
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
  created_at: Date;
  updated_at: Date;
  img: string | null;
  reset_otp_hash?: string | null;
  reset_otp_expires_at?: Date | null;
  login_count?: number | null;
  last_login_at?: Date | null;
};

/** Get staff by primary key. Returns null if not found or DB not configured. */
export async function getStaffById(staffId: string): Promise<StaffRow | null> {
  if (!pool) return null;
  const res = await pool.query<StaffRow>(
    `SELECT id, pernr, name, email, password_hash, role, actual_role, pseudo_role, faculty_id, created_at, updated_at, img
     FROM staff
     WHERE id = $1
     LIMIT 1`,
    [staffId]
  );
  return res.rows[0] ?? null;
}

/** Get staff by email (case-insensitive). Returns null if not found or DB not configured. */
export async function getStaffByEmail(email: string): Promise<StaffRow | null> {
  if (!pool) return null;
  const res = await pool.query<StaffRow>(
    `SELECT id, pernr, name, email, password_hash, role, actual_role, pseudo_role, faculty_id, created_at, updated_at, img
     FROM staff
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
     LIMIT 1`,
    [email]
  );
  return res.rows[0] ?? null;
}

/** Get department_ids for a staff member (HoD). Returns empty array if none or DB not configured. */
export async function getStaffDepartmentIds(staffId: string): Promise<string[]> {
  if (!pool) return [];
  const res = await pool.query<{ department_id: string }>(
    `SELECT department_id FROM staff_departments WHERE staff_id = $1`,
    [staffId]
  );
  return res.rows.map((r) => r.department_id);
}

/** Get staff by email with department_ids (for HoD). Use for login/session. */
export async function getStaffByEmailWithDepartments(
  email: string
): Promise<{ staff: StaffRow; departmentIds: string[] } | null> {
  const staff = await getStaffByEmail(email);
  if (!staff) return null;
  const departmentIds = staff.role === "hod" ? await getStaffDepartmentIds(staff.id) : [];
  return { staff, departmentIds };
}

/** Profile screen: staff row plus faculty / department labels (matches schema.staff). */
export type StaffProfileView = {
  id: string;
  pernr: string;
  name: string;
  email: string;
  role: StaffRow["role"];
  actual_role: StaffRow["actual_role"];
  pseudo_role: StaffRow["pseudo_role"];
  faculty_id: string | null;
  faculty_name: string | null;
  department_ids: string[];
  department_names: string[];
  img: string | null;
  has_password: boolean;
  created_at: string;
};

export async function getStaffProfileById(staffId: string): Promise<StaffProfileView | null> {
  if (!pool) return null;
  const staffRes = await pool.query<StaffRow>(
    `SELECT id, pernr, name, email, password_hash, role, actual_role, pseudo_role, faculty_id, created_at, updated_at, img
     FROM staff WHERE id = $1 LIMIT 1`,
    [staffId]
  );
  const row = staffRes.rows[0];
  if (!row) return null;

  let faculty_name: string | null = null;
  if (row.faculty_id) {
    const fr = await pool.query<{ name: string }>(
      `SELECT name FROM faculties WHERE id = $1 LIMIT 1`,
      [row.faculty_id]
    );
    faculty_name = fr.rows[0]?.name ?? null;
  }

  const department_ids =
    row.role === "hod" ? await getStaffDepartmentIds(staffId) : [];

  let department_names: string[] = [];
  if (department_ids.length > 0) {
    const dr = await pool.query<{ name: string }>(
      `SELECT name FROM departments WHERE id = ANY($1::varchar[]) ORDER BY name ASC`,
      [department_ids]
    );
    department_names = dr.rows.map((r) => r.name);
  }

  return {
    id: row.id,
    pernr: row.pernr,
    name: row.name,
    email: row.email,
    role: row.role,
    actual_role: row.actual_role,
    pseudo_role: row.pseudo_role,
    faculty_id: row.faculty_id,
    faculty_name,
    department_ids,
    department_names,
    img: row.img,
    has_password: !!row.password_hash,
    created_at: row.created_at.toISOString(),
  };
}

export async function updateStaffPasswordHash(
  staffId: string,
  passwordHash: string
): Promise<boolean> {
  if (!pool) return false;
  const res = await pool.query(
    `UPDATE staff SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [passwordHash, staffId]
  );
  return res.rowCount === 1;
}

export async function updateStaffImg(staffId: string, imgRelativePath: string): Promise<boolean> {
  if (!pool) return false;
  const res = await pool.query(
    `UPDATE staff SET img = $1, updated_at = NOW() WHERE id = $2`,
    [imgRelativePath, staffId]
  );
  return res.rowCount === 1;
}

export async function setStaffResetOtpByEmail(
  email: string,
  otpHash: string,
  expiresAt: Date
): Promise<boolean> {
  if (!pool) return false;
  const res = await pool.query(
    `UPDATE staff
     SET reset_otp_hash = $1, reset_otp_expires_at = $2, updated_at = NOW()
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($3))`,
    [otpHash, expiresAt, email]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function clearStaffResetOtpById(staffId: string): Promise<boolean> {
  if (!pool) return false;
  const res = await pool.query(
    `UPDATE staff
     SET reset_otp_hash = NULL, reset_otp_expires_at = NULL, updated_at = NOW()
     WHERE id = $1`,
    [staffId]
  );
  return res.rowCount === 1;
}

export async function getStaffResetOtpInfoByEmail(email: string): Promise<{
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  reset_otp_hash: string | null;
  reset_otp_expires_at: Date | null;
} | null> {
  if (!pool) return null;
  const res = await pool.query<{
    id: string;
    email: string;
    name: string;
    password_hash: string | null;
    reset_otp_hash: string | null;
    reset_otp_expires_at: Date | null;
  }>(
    `SELECT id, email, name, password_hash, reset_otp_hash, reset_otp_expires_at
     FROM staff
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
     LIMIT 1`,
    [email]
  );
  return res.rows[0] ?? null;
}

export async function bumpStaffLoginStats(staffId: string): Promise<boolean> {
  if (!pool) return false;
  const res = await pool.query(
    `UPDATE staff
     SET login_count = COALESCE(login_count, 0) + 1,
         last_login_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [staffId]
  );
  return res.rowCount === 1;
}

export type WellbeingCounsellorEmailOption = {
  id: string;
  name: string;
  email: string;
};

export async function getWellbeingCounsellorEmailOptions(): Promise<
  WellbeingCounsellorEmailOption[]
> {
  if (!pool) return [];
  const res = await pool.query<WellbeingCounsellorEmailOption>(
    `SELECT id::text, name, email
     FROM staff
     WHERE role = 'wellbeing-counseller'
       AND TRIM(COALESCE(email, '')) <> ''
     ORDER BY name ASC`
  );
  return res.rows;
}
