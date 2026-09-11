import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";
import {
  isStoredPseudoRole,
  normalizeActualRoleFromForm,
  staffRolePairErrorMessage,
  type StoredActualRole,
  type StoredPseudoRole,
} from "@/lib/staff-role-rules";

type UpdatePayload = {
  name?: string;
  email?: string;
  pernr?: string;
  actual_role?: string;
  pseudo_role?: string;
  faculty_id?: string;
  parent_department_id?: string | null;
  password?: string;
  department_ids?: string[];
};

function badRequest(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isDeanAllowedInstructorRole(
  pseudo: StoredPseudoRole,
  actual: StoredActualRole
): boolean {
  return pseudo === "instructor" && actual === "instructor";
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!pool) return badRequest("db_not_configured", 500);

  const currentUser = await getCurrentUser();
  if (!currentUser) return badRequest("unauthorized", 401);

  const accessRole = currentUser.pseudo_role ?? currentUser.role;
  const isSuperadmin = accessRole === "superadmin";
  const isDean = accessRole === "dean";
  if (!isSuperadmin && !isDean) return badRequest("forbidden", 403);
  if (isDean && !currentUser.faculty_id) return badRequest("faculty_required", 403);

  const { id } = await context.params;
  const staffId = String(id ?? "").trim();
  if (!staffId) return badRequest("missing_required");

  let body: UpdatePayload;
  try {
    body = (await req.json()) as UpdatePayload;
  } catch {
    return badRequest("invalid_json");
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const pernr = String(body.pernr ?? "").trim();
  const actualRoleRaw = String(body.actual_role ?? "").trim();
  const normalizedActual = normalizeActualRoleFromForm(actualRoleRaw);
  const pseudoRoleRaw = String(body.pseudo_role ?? "").trim();
  const facultyIdRaw = String(body.faculty_id ?? "").trim();
  let facultyId = facultyIdRaw.length ? facultyIdRaw : null;
  const parentDepartmentIdRaw = String(body.parent_department_id ?? "").trim();
  const parentDepartmentId = parentDepartmentIdRaw.length ? parentDepartmentIdRaw : null;
  const password = String(body.password ?? "").trim();
  const departmentIds = (body.department_ids ?? []).map((v) => String(v).trim()).filter(Boolean);

  if (!name || !email || !pernr || !normalizedActual || !pseudoRoleRaw) {
    return badRequest("missing_required");
  }
  const actualRole = normalizedActual as StoredActualRole;
  if (!isStoredPseudoRole(pseudoRoleRaw)) return badRequest("invalid_role");
  const pseudoRole = pseudoRoleRaw as StoredPseudoRole;
  if (staffRolePairErrorMessage(actualRole, pseudoRole)) return badRequest("invalid_role");

  if (isDean) {
    facultyId = currentUser.faculty_id;
    if (!isDeanAllowedInstructorRole(pseudoRole, actualRole)) {
      return badRequest("invalid_role", 403);
    }

    const existing = await pool.query<{
      faculty_id: string | null;
      pseudo_role: string | null;
      role: string | null;
      actual_role: string | null;
    }>(
      `SELECT faculty_id, pseudo_role, role, actual_role FROM staff WHERE id = $1 LIMIT 1`,
      [staffId]
    );
    const existingRow = existing.rows[0];
    if (!existingRow) return badRequest("not_found", 404);
    if (existingRow.faculty_id !== currentUser.faculty_id) {
      return badRequest("forbidden", 403);
    }
    const existingAccess = existingRow.pseudo_role ?? existingRow.role;
    if (existingAccess !== "instructor" || existingRow.actual_role !== "instructor") {
      return badRequest("forbidden", 403);
    }
  }

  if (!facultyId) return badRequest("faculty_required");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (password) {
      const passwordHash = await hash(password, 10);
      await client.query(
        `UPDATE staff
         SET name = $1, email = $2, pernr = $3, role = $4, actual_role = $5, pseudo_role = $6, faculty_id = $7, parent_department_id = $8, password_hash = $9, updated_at = NOW()
         WHERE id = $10`,
        [name, email, pernr, pseudoRole, actualRole, pseudoRole, facultyId, parentDepartmentId, passwordHash, staffId]
      );
    } else {
      await client.query(
        `UPDATE staff
         SET name = $1, email = $2, pernr = $3, role = $4, actual_role = $5, pseudo_role = $6, faculty_id = $7, parent_department_id = $8, updated_at = NOW()
         WHERE id = $9`,
        [name, email, pernr, pseudoRole, actualRole, pseudoRole, facultyId, parentDepartmentId, staffId]
      );
    }

    await client.query(`DELETE FROM staff_departments WHERE staff_id = $1`, [staffId]);
    if (pseudoRole === "hod" && departmentIds.length > 0) {
      for (const departmentId of departmentIds) {
        await client.query(
          `INSERT INTO staff_departments (staff_id, department_id)
           VALUES ($1, $2)
           ON CONFLICT (staff_id, department_id) DO NOTHING`,
          [staffId, departmentId]
        );
      }
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    const code =
      typeof error === "object" && error != null && "code" in error
        ? String((error as { code?: string }).code ?? "")
        : "";
    if (code === "23505") return badRequest("duplicate", 409);
    return badRequest("update_failed", 500);
  } finally {
    client.release();
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!pool) return badRequest("db_not_configured", 500);

  const currentUser = await getCurrentUser();
  if (!currentUser) return badRequest("unauthorized", 401);
  const accessRole = currentUser.pseudo_role ?? currentUser.role;
  if (accessRole !== "superadmin") return badRequest("forbidden", 403);

  const { id } = await context.params;
  const staffId = String(id ?? "").trim();
  if (!staffId) return badRequest("delete_failed");

  try {
    await pool.query(`DELETE FROM staff WHERE id = $1`, [staffId]);
    return NextResponse.json({ ok: true });
  } catch {
    return badRequest("delete_failed", 500);
  }
}
