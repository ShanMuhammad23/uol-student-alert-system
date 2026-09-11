import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";
import { StaffDirectoryPanelClient } from "@/app/dashboard/superadmin/staff/_components/StaffDirectoryPanelClient";
import { LoginTrendPanelClient } from "@/app/dashboard/superadmin/staff/_components/LoginTrendPanelClient";
import { AddStaffForm } from "@/app/dashboard/superadmin/staff/_components/AddStaffForm";
import { StaffTabs, type StaffTab } from "@/app/dashboard/superadmin/staff/_components/StaffTabs";
import { StaffToastFeedback } from "@/app/dashboard/superadmin/staff/_components/StaffToastFeedback";
import {
  createStaffMember,
  validateStaffFields,
} from "@/app/dashboard/superadmin/staff/create-staff-action";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import {
  queryStaffList,
  queryFaculties,
  queryDepartments,
  queryStaffLoginTrend,
} from "@/lib/staff-directory-queries";
import type { StoredPseudoRole } from "@/lib/staff-role-rules";

const DEAN_STAFF_TABS: StaffTab[] = ["directory", "login-trend", "add"];

const DEAN_ALLOWED_PSEUDO_ROLES: StoredPseudoRole[] = ["instructor"];

function isDeanPseudo(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): boolean {
  return (user.pseudo_role ?? user.role) === "dean";
}

function resolveStaffTab(tab: string | undefined): StaffTab {
  if (tab === "add") return "add";
  if (tab === "login-trend") return "login-trend";
  return "directory";
}

export default async function FacultyStaffPage(props: {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    tab?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }
  if (!isDeanPseudo(user) || !user.faculty_id) {
    redirect("/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const activeTab = resolveStaffTab(searchParams.tab);
  const facultyId = user.faculty_id;

  const [staff, loginTrend, allFaculties, allDepartments] = await Promise.all([
    activeTab === "directory"
      ? queryStaffList({ facultyId, excludeSuperadmin: true })
      : Promise.resolve([]),
    activeTab === "login-trend"
      ? queryStaffLoginTrend({ facultyId })
      : Promise.resolve(null),
    queryFaculties(),
    queryDepartments(),
  ]);

  const faculties = allFaculties.filter((f) => f.id === facultyId);
  const departments = allDepartments.filter((d) => d.faculty_id === facultyId);

  const facultyLabel =
    faculties[0] != null
      ? resolveFacultyNameFromIdOrName(faculties[0].id, faculties[0].name) ??
        faculties[0].name ??
        facultyId
      : facultyId;

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
        ? "Selected roles are invalid for this faculty staff account."
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
    <div className="mx-auto space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Faculty staff
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Staff in {facultyLabel}. Add accounts, review directory, and track login activity.
          </p>
        </div>
        <Link
          href="?tab=add"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm outline-none transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <UserPlus aria-hidden className="size-4" />
          Add Staff
        </Link>
      </div>

      <StaffToastFeedback successMessage={successMessage} errorMessage={errorMessage} />

      <StaffTabs activeTab={activeTab} allowedTabs={DEAN_STAFF_TABS} />

      {activeTab === "add" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Add New Staff
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create a staff account in {facultyLabel}.
            </p>
          </div>
          <AddStaffForm
            createStaff={createStaffMember}
            validateStaffFields={validateStaffFields}
            faculties={faculties}
            departments={departments.map((department) => ({
              id: department.id,
              name: department.name,
              faculty_id: department.faculty_id,
            }))}
            lockedFacultyId={facultyId}
            allowedPseudoRoles={DEAN_ALLOWED_PSEUDO_ROLES}
          />
        </div>
      ) : activeTab === "login-trend" && loginTrend ? (
        <LoginTrendPanelClient
          daily={loginTrend.daily}
          byFaculty={loginTrend.byFaculty}
        />
      ) : (
        <StaffDirectoryPanelClient
          staff={staff}
          faculties={faculties}
          departments={departments}
          scopedFacultyId={facultyId}
          readOnly
          canEdit
          canDelete={false}
          lockedFacultyId={facultyId}
          allowedPseudoRoles={DEAN_ALLOWED_PSEUDO_ROLES}
        />
      )}
    </div>
  );
}
