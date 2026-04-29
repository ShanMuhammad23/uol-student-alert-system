import { pool } from "@/lib/db";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { StaffDirectoryTableClient } from "@/app/dashboard/superadmin/staff/_components/StaffDirectoryTableClient";
import { AddStaffForm } from "./_components/AddStaffForm";
import { StaffToastFeedback } from "./_components/StaffToastFeedback";
import { cn } from "@/lib/utils";
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

// ─── Role Badge Helper ─────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    superadmin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    dean: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    hod: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    instructor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "wellbeing-head": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    "wellbeing-counseller": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  };

  const labels: Record<string, string> = {
    superadmin: "Superadmin",
    dean: "Dean",
    hod: "HOD",
    instructor: "Instructor",
    "wellbeing-head": "Wellbeing Head",
    "wellbeing-counseller": "Counsellor",
  };

  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
      styles[role] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    )}>
      {labels[role] ?? role}
    </span>
  );
}

// ─── Stats Card ────────────────────────────────────────────────────
function StatCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "violet" | "emerald" | "blue" }) {
  const tones = {
    neutral: "bg-slate-50 border-slate-200 text-slate-900 dark:bg-slate-800/50 dark:border-slate-700",
    violet: "bg-violet-50 border-violet-200 text-violet-900 dark:bg-violet-900/20 dark:border-violet-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800",
    blue: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800",
  };

  return (
    <div className={cn("rounded-xl border p-4", tones[tone])}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

export default async function SuperadminStaffPage(props: {
  searchParams?: Promise<{ success?: string; error?: string; tab?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const activeTab = searchParams.tab === "add" ? "add" : "directory";
  
  const staff = await getStaffList();
  const faculties = await getFaculties();
  const departments = await getDepartments();

  // Calculate stats
  const totalStaff = staff.length;
  const byRole = staff.reduce((acc, s) => {
    acc[s.role] = (acc[s.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const deanCount = byRole.dean || 0;
  const hodCount = byRole.hod || 0;
  const instructorCount = byRole.instructor || 0;
  const superadminCount = byRole.superadmin || 0;
  const counsellorHeadCount = byRole["wellbeing-head"] || 0;
  const counsellorCount = byRole["wellbeing-counseller"] || 0;

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
    <div className="mx-auto  space-y-6 pb-8">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Staff Directory</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage system staff accounts and permissions
          </p>
        </div>
        <a
          href="?tab=add"
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "add"
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          )}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Staff
        </a>
      </div>

      {/* ─── Stats Row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Total Staff" value={totalStaff} tone="neutral" />
        <StatCard label="Superadmins" value={superadminCount} tone="violet" />
        <StatCard label="Deans" value={deanCount} tone="violet" />
        <StatCard label="HoDs" value={hodCount} tone="emerald" />
        <StatCard label="Instructors" value={instructorCount} tone="blue" />
        <StatCard label="Counsellor Heads" value={counsellorHeadCount} tone="emerald" />
        <StatCard label="Counsellors" value={counsellorCount} tone="blue" />
      </div>

      <StaffToastFeedback successMessage={successMessage} errorMessage={errorMessage} />

      {/* ─── Tab Navigation ──────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-1">
          <a
            href="?tab=directory"
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "directory"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            )}
          >
            Directory
            {activeTab === "directory" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
            )}
          </a>
          <a
            href="?tab=add"
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "add"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            )}
          >
            Add New Staff
            {activeTab === "add" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
            )}
          </a>
        </nav>
      </div>

      {/* ─── Tab Content ─────────────────────────────────────────── */}
      {activeTab === "add" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add New Staff</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create a new staff account with appropriate role and permissions.
            </p>
          </div>
          <AddStaffForm
            action={createStaffAction}
            faculties={faculties}
            departments={departments.map((department) => ({
              id: department.id,
              name: department.name,
            }))}
          />
        </div>
      ) : (
        <StaffDirectoryTableClient
          staff={staff}
          faculties={faculties}
          departments={departments}
          updateStaffAction={updateStaffAction}
          deleteStaffAction={deleteStaffAction}
        />
      )}
    </div>
  );
}