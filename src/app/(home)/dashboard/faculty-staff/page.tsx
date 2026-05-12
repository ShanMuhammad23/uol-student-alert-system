import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";
import { StaffDirectoryPanelClient } from "@/app/dashboard/superadmin/staff/_components/StaffDirectoryPanelClient";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import {
  queryStaffList,
  queryFaculties,
  queryDepartments,
} from "@/lib/staff-directory-queries";

function isDeanPseudo(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): boolean {
  return (user.pseudo_role ?? user.role) === "dean";
}

export default async function FacultyStaffPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }
  if (!isDeanPseudo(user) || !user.faculty_id) {
    redirect("/dashboard");
  }

  const facultyId = user.faculty_id;

  const [staff, allFaculties, allDepartments] = await Promise.all([
    queryStaffList({ facultyId }),
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

  return (
    <div className="mx-auto space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Faculty staff</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Staff in {facultyLabel}. This directory is view-only.
        </p>
      </div>

      <StaffDirectoryPanelClient
        staff={staff}
        faculties={faculties}
        departments={departments}
        scopedFacultyId={facultyId}
        readOnly
      />
    </div>
  );
}
