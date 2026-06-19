import { StaffDirectoryPanelClient } from "@/app/dashboard/superadmin/staff/_components/StaffDirectoryPanelClient";
import { UnregisteredStaffPanelClient } from "@/app/dashboard/superadmin/staff/_components/UnregisteredStaffPanelClient";
import { AddStaffForm } from "./_components/AddStaffForm";
import { createStaffMember, validateStaffFields } from "./create-staff-action";
import { StaffToastFeedback } from "./_components/StaffToastFeedback";
import { cn } from "@/lib/utils";
import {
  queryStaffList,
  queryUnregisteredStaffList,
  queryFaculties,
  queryDepartments,
  type DepartmentRow,
} from "@/lib/staff-directory-queries";

export type { DepartmentRow };

type StaffTab = "directory" | "add" | "unregistered";

function resolveStaffTab(tab: string | undefined): StaffTab {
  if (tab === "add") return "add";
  if (tab === "unregistered") return "unregistered";
  return "directory";
}

export default async function SuperadminStaffPage(props: {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    tab?: string;
    page?: string;
    faculty?: string;
    department?: string;
    q?: string;
  }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const activeTab = resolveStaffTab(searchParams.tab);
  const unregisteredPage = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const unregisteredFacultyId = searchParams.faculty?.trim() || null;
  const unregisteredDepartmentId = searchParams.department?.trim() || null;
  const unregisteredSearch = searchParams.q?.trim() ?? "";

  const [staff, unregisteredStaff, faculties, departments] = await Promise.all([
    activeTab === "directory" ? queryStaffList() : Promise.resolve([]),
    activeTab === "unregistered"
      ? queryUnregisteredStaffList({
          page: unregisteredPage,
          facultyId: unregisteredFacultyId,
          departmentId: unregisteredDepartmentId,
          search: unregisteredSearch || null,
        })
      : Promise.resolve(null),
    queryFaculties(),
    queryDepartments(),
  ]);

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
            href="?tab=unregistered"
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "unregistered"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            )}
          >
            Un-Registered Staff
            {activeTab === "unregistered" && (
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
      ) : activeTab === "unregistered" && unregisteredStaff ? (
        <UnregisteredStaffPanelClient
          staff={unregisteredStaff.rows}
          total={unregisteredStaff.total}
          page={unregisteredStaff.page}
          pageSize={unregisteredStaff.pageSize}
          totalPages={unregisteredStaff.totalPages}
          faculties={faculties}
          departments={departments}
          facultyId={unregisteredFacultyId}
          departmentId={unregisteredDepartmentId}
          search={unregisteredSearch}
          createStaff={createStaffMember}
        />
      ) : (
        <StaffDirectoryPanelClient
          staff={staff}
          faculties={faculties}
          departments={departments}
        />
      )}
    </div>
  );
}
