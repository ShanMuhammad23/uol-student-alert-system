import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { pool } from "@/lib/db";
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
  password?: string;
  department_ids?: string[];
};

function badRequest(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!pool) return badRequest("db_not_configured", 500);

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
  const facultyId = facultyIdRaw.length ? facultyIdRaw : null;
  const password = String(body.password ?? "").trim();
  const departmentIds = (body.department_ids ?? []).map((v) => String(v).trim()).filter(Boolean);

  if (!name || !email || !pernr || !normalizedActual || !pseudoRoleRaw) {
    return badRequest("missing_required");
  }
  const actualRole = normalizedActual as StoredActualRole;
  if (!isStoredPseudoRole(pseudoRoleRaw)) return badRequest("invalid_role");
  const pseudoRole = pseudoRoleRaw as StoredPseudoRole;
  if (staffRolePairErrorMessage(actualRole, pseudoRole)) return badRequest("invalid_role");
  if (!facultyId) return badRequest("faculty_required");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (password) {
      const passwordHash = await hash(password, 10);
      await client.query(
        `UPDATE staff
         SET name = $1, email = $2, pernr = $3, role = $4, actual_role = $5, pseudo_role = $6, faculty_id = $7, password_hash = $8, updated_at = NOW()
         WHERE id = $9`,
        [name, email, pernr, pseudoRole, actualRole, pseudoRole, facultyId, passwordHash, staffId]
      );
    } else {
      await client.query(
        `UPDATE staff
         SET name = $1, email = $2, pernr = $3, role = $4, actual_role = $5, pseudo_role = $6, faculty_id = $7, updated_at = NOW()
         WHERE id = $8`,
        [name, email, pernr, pseudoRole, actualRole, pseudoRole, facultyId, staffId]
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
