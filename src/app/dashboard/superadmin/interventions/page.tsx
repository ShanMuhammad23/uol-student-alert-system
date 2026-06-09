import Link from "next/link";
import { InterventionsPanelClient } from "./_components/InterventionsPanelClient";
import {
  queryCourses,
  queryDepartments,
  queryFaculties,
  queryPrograms,
} from "@/lib/staff-directory-queries";

export default async function SuperadminInterventionsPage() {
  const [faculties, departments, programs, courses] = await Promise.all([
    queryFaculties(),
    queryDepartments(),
    queryPrograms(),
    queryCourses(),
  ]);

  return (
    <div className="mx-auto space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Link
              href="/dashboard/superadmin"
              className="hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-300">Interventions</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            All Interventions
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Browse and filter every intervention recorded in the system
          </p>
        </div>
      </div>

      <InterventionsPanelClient
        faculties={faculties}
        departments={departments}
        programs={programs}
        courses={courses}
      />
    </div>
  );
}
