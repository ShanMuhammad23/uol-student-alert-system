import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";
import { EffectivenessPanelClient } from "@/components/effectiveness/EffectivenessPanelClient";
import {
  buildEffectivenessRows,
  getEffectivenessScores,
  getLatestEffectivenessSnapshotDate,
} from "@/lib/effectiveness";

async function loadScopedRows(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
) {
  const facultyIds = user.faculty_id ? [user.faculty_id] : [];
  const departmentIds = user.role === "hod" ? user.department_ids ?? [] : undefined;

  if (!facultyIds.length) {
    return { rows: [], snapshotDate: new Date().toISOString().slice(0, 10) };
  }

  const cached = await getEffectivenessScores({
    facultyIds,
    departmentIds,
    dimensionType: "department",
  });
  if (cached.length) {
    const snapshotDate =
      (await getLatestEffectivenessSnapshotDate()) ?? new Date().toISOString().slice(0, 10);
    return { rows: cached, snapshotDate };
  }

  try {
    let rows = await buildEffectivenessRows(undefined, { facultyIds });
    rows = rows.filter((r) => r.dimension_type === "department");
    if (departmentIds?.length) {
      const allowed = new Set(departmentIds);
      rows = rows.filter((r) => allowed.has(r.dimension_id));
    }
    return { rows, snapshotDate: rows[0]?.snapshot_date ?? new Date().toISOString().slice(0, 10) };
  } catch {
    return { rows: [], snapshotDate: new Date().toISOString().slice(0, 10) };
  }
}

export default async function DeanHodEffectivenessPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }
  if (user.role !== "dean" && user.role !== "hod") {
    redirect("/dashboard");
  }

  const { rows, snapshotDate } = await loadScopedRows(user);
  const title = user.role === "hod" ? "Department Effectiveness" : "Faculty Effectiveness";

  return (
    <div className="mx-auto space-y-6 pb-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/dashboard" className="hover:text-emerald-600 dark:hover:text-emerald-400">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-slate-300">Effectiveness</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Track how effectively your {user.role === "hod" ? "department" : "faculty"} responds to
          student alerts and connects at-risk students to wellbeing support.
        </p>
      </div>

      <EffectivenessPanelClient
        initialRows={rows}
        initialSnapshotDate={snapshotDate}
        defaultDimensionType="department"
        showFacultyTab={user.role === "dean"}
      />
    </div>
  );
}
