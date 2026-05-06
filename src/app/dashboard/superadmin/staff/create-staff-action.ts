"use server";

import { pool } from "@/lib/db";
import { isInstructorPernrInEnrollment } from "@/lib/db/staff-enrollment";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { sendStaffRoleAssignedEmail } from "@/lib/staff-role-assigned-email";

export type CreateStaffResult =
  | { ok: true }
  | { ok: false; message: string };

export async function createStaffMember(
  formData: FormData
): Promise<CreateStaffResult> {
  if (!pool) {
    return { ok: false, message: "Database is not configured." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pernr = String(formData.get("pernr") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor"
    | "wellbeing-head"
    | "wellbeing-counseller";
  const facultyIdRaw = String(formData.get("faculty_id") ?? "").trim();
  const facultyId = facultyIdRaw.length ? facultyIdRaw : null;

  if (!name || !email || !pernr || !password || !role) {
    return { ok: false, message: "Please fill all required fields." };
  }
  if (
    ![
      "superadmin",
      "dean",
      "hod",
      "instructor",
      "wellbeing-head",
      "wellbeing-counseller",
    ].includes(role)
  ) {
    return { ok: false, message: "Selected role is invalid." };
  }
  if (!facultyId) {
    return { ok: false, message: "Parent faculty is required." };
  }

  const enrollmentOk = await isInstructorPernrInEnrollment(pernr);
  if (!enrollmentOk) {
    return {
      ok: false,
      message:
        "Staff not found in enrollment: this PERNR does not appear as an instructor in current enrollment data.",
    };
  }

  const passwordHash = await hash(password, 10);
  const departmentIds = formData
    .getAll("department_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insertStaff = await client.query<{ id: string }>(
      `INSERT INTO staff (pernr, name, email, password_hash, role, faculty_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [pernr, name, email, passwordHash, role, facultyId]
    );
    const staffId = insertStaff.rows[0]?.id;

    if (role === "hod" && staffId && departmentIds.length) {
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
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    const code =
      typeof error === "object" && error != null && "code" in error
        ? String((error as { code?: string }).code ?? "")
        : "";
    if (code === "23505") {
      return { ok: false, message: "Email or Pernr already exists." };
    }
    return {
      ok: false,
      message: "Unable to add staff. Please verify field values.",
    };
  } finally {
    client.release();
  }

  try {
    let parentFaculty = "—";
    if (facultyId) {
      const fn = await pool.query<{ name: string }>(
        `SELECT name FROM faculties WHERE id = $1 LIMIT 1`,
        [facultyId]
      );
      const nameFromDb = fn.rows[0]?.name?.trim() ?? null;
      parentFaculty =
        resolveFacultyNameFromIdOrName(facultyId, nameFromDb) ?? "—";
    }
    await sendStaffRoleAssignedEmail({
      to: email,
      name,
      parentFaculty,
      registeredEmail: email,
      roleKey: role,
    });
  } catch (err) {
    console.error("[staff] Role-assigned welcome email failed:", err);
  }

  revalidatePath("/dashboard/superadmin/staff");
  return { ok: true };
}
