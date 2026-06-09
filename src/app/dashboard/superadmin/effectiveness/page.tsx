import Link from "next/link";
import { EffectivenessPanelClient } from "@/components/effectiveness/EffectivenessPanelClient";
import {
  buildEffectivenessRows,
  getEffectivenessScores,
  getLatestEffectivenessSnapshotDate,
} from "@/lib/effectiveness";
import { queryFaculties } from "@/lib/staff-directory-queries";

async function loadInitialRows() {
  const faculties = await queryFaculties();
  const facultyIds = faculties.map((f) => f.id).filter(Boolean);
  if (!facultyIds.length) {
    return { rows: [], snapshotDate: new Date().toISOString().slice(0, 10) };
  }

  const cached = await getEffectivenessScores({ facultyIds });
  if (cached.length) {
    const snapshotDate =
      (await getLatestEffectivenessSnapshotDate()) ?? new Date().toISOString().slice(0, 10);
    return { rows: cached, snapshotDate };
  }

  try {
    const rows = await buildEffectivenessRows(undefined, { facultyIds });
    return { rows, snapshotDate: rows[0]?.snapshot_date ?? new Date().toISOString().slice(0, 10) };
  } catch {
    return { rows: [], snapshotDate: new Date().toISOString().slice(0, 10) };
  }
}

export default async function SuperadminEffectivenessPage() {
  const { rows, snapshotDate } = await loadInitialRows();

  return (
    <div className="mx-auto space-y-6 pb-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link
            href="/dashboard/superadmin"
            className="hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-slate-300">Effectiveness</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
          Faculty &amp; Department Effectiveness
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Wellbeing-focused effectiveness index (FEI) — intervention coverage, referral uptake,
          student recovery, and data readiness.
        </p>
      </div>

      <EffectivenessPanelClient
        initialRows={rows}
        initialSnapshotDate={snapshotDate}
        defaultDimensionType="faculty"
        showFacultyTab
      />
    </div>
  );
}
