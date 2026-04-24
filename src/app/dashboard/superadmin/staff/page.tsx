import { pool } from "@/lib/db";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { StaffDirectoryTableClient } from "@/app/dashboard/superadmin/staff/_components/StaffDirectoryTableClient";
import { AddStaffForm } from "./_components/AddStaffForm";

type StaffListRow = {
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
    | "wellbeing-head"
    | "wellbeing-counseller";
  faculty_id: string | null;
  faculty_name: string | null;
  department_names: string[] | null;
  department_ids: string[] | null;
  login_count: number | null;
  last_login_at: string | null;
};

type FacultyRow = {
  id: string;
  name: string;
};

export type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  faculty_id: string | null;
};

async function getStaffList(): Promise<StaffListRow[]> {
  if (!pool) return [];
  const res = await pool.query<StaffListRow>(
    `SELECT
       s.id,
       s.pernr,
       s.name,
       s.img,
       s.email,
       s.role,
       s.faculty_id,
       f.name AS faculty_name,
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
     GROUP BY s.id, s.pernr, s.name, s.img, s.email, s.role, s.faculty_id, f.name, s.login_count, s.last_login_at
     ORDER BY s.role ASC, s.name ASC`
  );
  return res.rows;
}

async function getFaculties(): Promise<FacultyRow[]> {
  if (!pool) return [];
  const res = await pool.query<FacultyRow>(
    `SELECT id, name FROM faculties ORDER BY name ASC`
  );
  return res.rows;
}

async function getDepartments(): Promise<DepartmentRow[]> {
  if (!pool) return [];
  const res = await pool.query<DepartmentRow>(
    `SELECT id, name, code, faculty_id
     FROM departments
     ORDER BY name ASC`
  );
  return res.rows;
}

async function createStaffAction(formData: FormData) {
  "use server";
  if (!pool) {
    redirect("/dashboard/superadmin/staff?error=db_not_configured");
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
    redirect("/dashboard/superadmin/staff?error=missing_required");
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
    redirect("/dashboard/superadmin/staff?error=invalid_role");
  }
  if ((role === "dean" || role === "instructor") && !facultyId) {
    redirect("/dashboard/superadmin/staff?error=faculty_required");
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
      redirect("/dashboard/superadmin/staff?error=duplicate");
    }
    redirect("/dashboard/superadmin/staff?error=create_failed");
  } finally {
    client.release();
  }

  revalidatePath("/dashboard/superadmin/staff");
  redirect("/dashboard/superadmin/staff?success=created");
}

async function updateStaffAction(formData: FormData) {
  "use server";
  if (!pool) {
    redirect("/dashboard/superadmin/staff?error=db_not_configured");
  }

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pernr = String(formData.get("pernr") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor"
    | "wellbeing-head"
    | "wellbeing-counseller";
  const facultyIdRaw = String(formData.get("faculty_id") ?? "").trim();
  const facultyId = facultyIdRaw.length ? facultyIdRaw : null;
  const password = String(formData.get("password") ?? "").trim();

  if (!id || !name || !email || !pernr || !role) {
    redirect("/dashboard/superadmin/staff?error=missing_required");
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
    redirect("/dashboard/superadmin/staff?error=invalid_role");
  }

  if ((role === "dean" || role === "instructor") && !facultyId) {
    redirect("/dashboard/superadmin/staff?error=faculty_required");
  }

  const departmentIds = formData
    .getAll("department_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (password) {
      const passwordHash = await hash(password, 10);
      await client.query(
        `UPDATE staff
         SET name = $1, email = $2, pernr = $3, role = $4, faculty_id = $5, password_hash = $6, updated_at = NOW()
         WHERE id = $7`,
        [name, email, pernr, role, facultyId, passwordHash, id]
      );
    } else {
      await client.query(
        `UPDATE staff
         SET name = $1, email = $2, pernr = $3, role = $4, faculty_id = $5, updated_at = NOW()
         WHERE id = $6`,
        [name, email, pernr, role, facultyId, id]
      );
    }

    await client.query(`DELETE FROM staff_departments WHERE staff_id = $1`, [id]);
    if (role === "hod" && departmentIds.length > 0) {
      for (const departmentId of departmentIds) {
        await client.query(
          `INSERT INTO staff_departments (staff_id, department_id)
           VALUES ($1, $2)
           ON CONFLICT (staff_id, department_id) DO NOTHING`,
          [id, departmentId]
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
      redirect("/dashboard/superadmin/staff?error=duplicate");
    }
    redirect("/dashboard/superadmin/staff?error=update_failed");
  } finally {
    client.release();
  }

  revalidatePath("/dashboard/superadmin/staff");
  redirect("/dashboard/superadmin/staff?success=updated");
}

async function deleteStaffAction(formData: FormData) {
  "use server";
  if (!pool) {
    redirect("/dashboard/superadmin/staff?error=db_not_configured");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/dashboard/superadmin/staff?error=delete_failed");
  }

  try {
    await pool.query(`DELETE FROM staff WHERE id = $1`, [id]);
  } catch {
    redirect("/dashboard/superadmin/staff?error=delete_failed");
  }

  revalidatePath("/dashboard/superadmin/staff");
  redirect("/dashboard/superadmin/staff?success=deleted");
}

export default async function SuperadminStaffPage(props: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const staff = await getStaffList();
  const faculties = await getFaculties();
  const departments = await getDepartments();
  const successMessage =
    searchParams.success === "created"
      ? "Staff added successfully."
      : searchParams.success === "updated"
      ? "Staff updated successfully."
      : searchParams.success === "deleted"
      ? "Staff deleted successfully."
      : null;
  const errorMessage =
    searchParams.error === "missing_required"
      ? "Please fill all required fields."
      : searchParams.error === "invalid_role"
      ? "Selected role is invalid."
      : searchParams.error === "faculty_required"
      ? "Faculty is required for Dean and Instructor."
      : searchParams.error === "duplicate"
      ? "Email or Pernr already exists."
      : searchParams.error === "db_not_configured"
      ? "Database is not configured."
      : searchParams.error === "create_failed"
      ? "Unable to add staff. Please verify field values."
      : searchParams.error === "update_failed"
      ? "Unable to update staff. Please verify field values."
      : searchParams.error === "delete_failed"
      ? "Unable to delete staff."
      : null;

  return (
    <div className="space-y-5">
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h1 className="text-2xl font-bold text-dark dark:text-white">
          Staff Directory
        </h1>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Manage and review all system staff accounts.
        </p>
      </div>

      <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Add Staff
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Add superadmin, dean, hod, instructor, or wellbeing accounts.
        </p>

        {successMessage && (
          <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
            {successMessage}
          </p>
        )}
        {errorMessage && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {errorMessage}
          </p>
        )}

        <AddStaffForm
          action={createStaffAction}
          faculties={faculties}
          departments={departments.map((department) => ({
            id: department.id,
            name: department.name,
          }))}
        />
      </div>

      <StaffDirectoryTableClient
        staff={staff}
        faculties={faculties}
        departments={departments}
        updateStaffAction={updateStaffAction}
        deleteStaffAction={deleteStaffAction}
      />
    </div>
  );
}
