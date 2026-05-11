import { StaffDirectoryTableClient } from "@/app/dashboard/superadmin/staff/_components/StaffDirectoryTableClient";
import { AddStaffForm } from "./_components/AddStaffForm";
import { createStaffMember, validateStaffFields } from "./create-staff-action";
import { StaffToastFeedback } from "./_components/StaffToastFeedback";
import { StaffStatsCards } from "./_components/StaffStatsCards";
import { cn } from "@/lib/utils";
import { pool } from "@/lib/db";
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
       s.actual_role,
       s.pseudo_role,
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
     GROUP BY s.id, s.pernr, s.name, s.img, s.email, s.role, s.actual_role, s.pseudo_role, s.faculty_id, f.name, s.login_count, s.last_login_at
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
  const byActualRole = staff.reduce((acc, s) => {
    const key = s.actual_role ?? "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const superadminCount = byActualRole.superadmin || 0;
  const deanCount = byActualRole.dean || 0;
  const hodCount = byActualRole.hod || 0;
  const instructorCount = byActualRole.instructor || 0;
  const counsellorHeadCount = byActualRole["wellbeing-head"] || 0;
  const counsellorCount = byActualRole["wellbeing-counseller"] || 0;
  const wellbeingStaffCount = counsellorHeadCount + counsellorCount;

  // Pseudo leadership = pseudo dean/hod, but actual admin/coordinator
  const pseudoDeanCount = staff.filter(
    (s) =>
      s.pseudo_role === "dean" &&
      (s.actual_role === "admin" || s.actual_role === "coordinator")
  ).length;
  const pseudoHodCount = staff.filter(
    (s) =>
      s.pseudo_role === "hod" &&
      (s.actual_role === "admin" || s.actual_role === "coordinator")
  ).length;

  const successMessage =
    searchParams.success === "updated"
      ? "Staff updated successfully."
      : searchParams.success === "deleted"
      ? "Staff deleted successfully."
      : null;
  const errorMessage =
    searchParams.error === "missing_required"
      ? "Please fill all required fields."
      : searchParams.error === "invalid_role"
      ? "Selected roles are invalid for this pseudo role (dean/HoD pseudo → actual admin/coordinator, dean, or HoD only; superadmin pseudo → actual superadmin only; wellbeing-head / wellbeing-counseller pseudo → matching actual only)."
      : searchParams.error === "faculty_required"
      ? "Parent faculty is required."
      : searchParams.error === "duplicate"
      ? "Email or Pernr already exists."
      : searchParams.error === "not_in_enrollment"
      ? "Staff not found in enrollment: this PERNR does not appear as an instructor in current enrollment data."
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
      <StaffStatsCards
        stats={{
          totalStaff,
          superadminCount,
          deanCount,
          hodCount,
          pseudoDeanCount,
          pseudoHodCount,
          instructorCount,
          wellbeingStaffCount,
        }}
      />

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
            createStaff={createStaffMember}
            validateStaffFields={validateStaffFields}
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
        />
      )}
    </div>
  );
}