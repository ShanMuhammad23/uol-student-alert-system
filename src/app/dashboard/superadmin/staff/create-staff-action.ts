"use server";

import { pool } from "@/lib/db";
import { isInstructorPernrInEnrollment } from "@/lib/db/staff-enrollment";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { sendStaffRoleAssignedEmail } from "@/lib/staff-role-assigned-email";
import {
  isStoredPseudoRole,
  normalizeActualRoleFromForm,
  staffRolePairErrorMessage,
  type StoredActualRole,
  type StoredPseudoRole,
} from "@/lib/staff-role-rules";

export type CreateStaffResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      code?: "enrollment_mismatch";
    };

export type StaffFieldValidationResult = {
  emailDuplicate: boolean;
  pernrDuplicate: boolean;
  pernrInEnrollment: boolean | null;
  enrollmentInstructorName: string | null;
  enrollmentInstructorEmail: string | null;
};

export async function validateStaffFields(
  emailRaw: string,
  pernrRaw: string
): Promise<StaffFieldValidationResult> {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  const pernr = String(pernrRaw ?? "").trim();

  let emailDuplicate = false;
  let pernrDuplicate = false;
  let pernrInEnrollment: boolean | null = null;
  let enrollmentInstructorName: string | null = null;
  let enrollmentInstructorEmail: string | null = null;

  if (pool) {
    type ValidationRow = {
      email_duplicate: boolean;
      pernr_duplicate: boolean;
      pernr_in_enrollment: boolean | null;
      enrollment_instructor_name: string | null;
      enrollment_instructor_email: string | null;
    };
    const valRes = await pool.query<ValidationRow>(
      `SELECT
         EXISTS(
           SELECT 1 FROM staff
           WHERE $1::text <> '' AND LOWER(TRIM(email)) = LOWER($1::text)
         ) AS email_duplicate,
         EXISTS(
           SELECT 1 FROM staff
           WHERE $2::text <> '' AND TRIM(BOTH FROM pernr) = TRIM(BOTH FROM $2::text)
         ) AS pernr_duplicate,
         CASE
           WHEN $2::text = '' OR TRIM(BOTH FROM $2::text) = '' THEN NULL::boolean
           ELSE EXISTS (
             SELECT 1
             FROM student_enrollment_current e
             WHERE e.is_active = TRUE
               AND e.instructor_pernr IS NOT NULL
               AND TRIM(BOTH FROM e.instructor_pernr) = TRIM(BOTH FROM $2::text)
           )
         END AS pernr_in_enrollment,
         CASE
           WHEN $2::text = '' OR TRIM(BOTH FROM $2::text) = '' THEN NULL::text
           ELSE (
             SELECT NULLIF(TRIM(MAX(e.instructor_name)), '')
             FROM student_enrollment_current e
             WHERE e.is_active = TRUE
               AND e.instructor_pernr IS NOT NULL
               AND TRIM(BOTH FROM e.instructor_pernr) = TRIM(BOTH FROM $2::text)
           )
         END AS enrollment_instructor_name,
         CASE
           WHEN $2::text = '' OR TRIM(BOTH FROM $2::text) = '' THEN NULL::text
           ELSE (
             SELECT NULLIF(TRIM(LOWER(MAX(e.instructor_email))), '')
             FROM student_enrollment_current e
             WHERE e.is_active = TRUE
               AND e.instructor_pernr IS NOT NULL
               AND TRIM(BOTH FROM e.instructor_pernr) = TRIM(BOTH FROM $2::text)
           )
         END AS enrollment_instructor_email`,
      [email, pernr]
    );
    const row = valRes.rows[0];
    if (row) {
      emailDuplicate = Boolean(row.email_duplicate);
      pernrDuplicate = Boolean(row.pernr_duplicate);
      pernrInEnrollment = row.pernr_in_enrollment;
      enrollmentInstructorName = row.enrollment_instructor_name?.trim() ?? null;
      enrollmentInstructorEmail = row.enrollment_instructor_email?.trim() ?? null;
    }
  }

  return {
    emailDuplicate,
    pernrDuplicate,
    pernrInEnrollment,
    enrollmentInstructorName,
    enrollmentInstructorEmail,
  };
}

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
  const actualRoleRaw = String(formData.get("actual_role") ?? "").trim();
  const normalizedActual = normalizeActualRoleFromForm(actualRoleRaw);
  const pseudoRoleRaw = String(formData.get("pseudo_role") ?? "").trim();
  const facultyIdRaw = String(formData.get("faculty_id") ?? "").trim();
  const facultyId = facultyIdRaw.length ? facultyIdRaw : null;
  const skipEnrollmentCheck = String(formData.get("skip_enrollment_check") ?? "").trim() === "1";

  if (!name || !email || !pernr || !password || !normalizedActual || !pseudoRoleRaw) {
    return { ok: false, message: "Please fill all required fields." };
  }
  const actualRole = normalizedActual as StoredActualRole;
  if (!isStoredPseudoRole(pseudoRoleRaw)) {
    return { ok: false, message: "Selected pseudo role is invalid." };
  }
  const pseudoRole = pseudoRoleRaw as StoredPseudoRole;
  const pairError = staffRolePairErrorMessage(actualRole, pseudoRole);
  if (pairError) {
    return { ok: false, message: pairError };
  }
  if (!facultyId) {
    return { ok: false, message: "Parent faculty is required." };
  }

  const enrollmentOk = await isInstructorPernrInEnrollment(pernr);
  if (!enrollmentOk && !skipEnrollmentCheck) {
    return {
      ok: false,
      code: "enrollment_mismatch",
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
      `INSERT INTO staff (pernr, name, email, password_hash, role, actual_role, pseudo_role, faculty_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [pernr, name, email, passwordHash, pseudoRole, actualRole, pseudoRole, facultyId]
    );
    const staffId = insertStaff.rows[0]?.id;

    if (pseudoRole === "hod" && staffId && departmentIds.length) {
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
    const detail =
      typeof error === "object" && error != null && "detail" in error
        ? String((error as { detail?: string }).detail ?? "")
        : "";
    if (code === "23505") {
      return { ok: false, message: "Email or Pernr already exists." };
    }
    if (code === "42703" || code === "42P01") {
      return {
        ok: false,
        message:
          "Database schema is missing required fields for roles. Please run the latest ALTER TABLE migration (actual_role/pseudo_role).",
      };
    }
    if (code === "23514") {
      return {
        ok: false,
        message: detail
          ? `Role validation failed in database: ${detail}`
          : "Role validation failed in database. Please verify actual role and pseudo role values.",
      };
    }
    return {
      ok: false,
      message: "Unable to add staff. Please verify field values and latest DB migration.",
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
      roleKey: pseudoRole,
    });
  } catch (err) {
    console.error("[staff] Role-assigned welcome email failed:", err);
  }

  revalidatePath("/dashboard/superadmin/staff");
  return { ok: true };
}
