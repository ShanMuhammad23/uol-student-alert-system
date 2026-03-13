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
  role: "dean" | "hod" | "instructor";
  faculty_id: string | null;
  created_at: Date;
  updated_at: Date;
  img: string | null;
};

/** Get staff by email (case-insensitive). Returns null if not found or DB not configured. */
export async function getStaffByEmail(email: string): Promise<StaffRow | null> {
  if (!pool) return null;
  const res = await pool.query<StaffRow>(
    `SELECT id, pernr, name, email, password_hash, role, faculty_id, created_at, updated_at, img
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
  const departmentIds =
    staff.role === "hod" ? await getStaffDepartmentIds(staff.id) : [];
  return { staff, departmentIds };
}
