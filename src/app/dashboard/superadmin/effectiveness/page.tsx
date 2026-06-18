import Link from "next/link";
import {
  buildEffectivenessRows,
  getEffectivenessScores,
  getEffectivenessTrend,
  getLatestEffectivenessSnapshotDate,
  normalizeDateString,
} from "@/lib/effectiveness";
import {
  getInterventionStatsForRoleScopeFromDb,
  type InterventionRoleScopeStats,
} from "@/lib/db/interventions";
import { queryFaculties } from "@/lib/staff-directory-queries";
import { FEIDashboardClient } from "./_components/FEIDashboardClient";
import {
  buildTrendByFaculty,
  mapRowToFacultyView,
} from "./map-faculty";

async function loadFacultyEffectiveness() {
  const faculties = await queryFaculties();
  const facultyIds = faculties.map((f) => f.id);

  const emptyInterventionStats: InterventionRoleScopeStats = {
    initiated: 0,
    inProgress: 0,
    referred: 0,
    resolved: 0,
    noActionRequired: 0,
    totalInterventionStudents: 0,
  };

  if (!facultyIds.length) {
    return {
      facultyViews: [],
      snapshotDate: new Date().toISOString().slice(0, 10),
      trendDates: [] as string[],
      interventionStats: emptyInterventionStats,
    };
  }

  let rows = await getEffectivenessScores({
    dimensionType: "faculty",
    facultyIds,
  });

  if (!rows.length) {
    try {
      rows = (await buildEffectivenessRows(undefined, { facultyIds })).filter(
        (r) => r.dimension_type === "faculty"
      );
    } catch {
      rows = [];
    }
  } else {
    rows = rows.filter((r) => r.dimension_type === "faculty");
  }

  const snapshotDate = normalizeDateString(
    rows[0]?.snapshot_date ??
      (await getLatestEffectivenessSnapshotDate()) ??
      new Date().toISOString().slice(0, 10)
  );

  const trendPoints = await getEffectivenessTrend(facultyIds, 5);
  const { trendDates, trendByFaculty } = buildTrendByFaculty(trendPoints, facultyIds);

  const facultyViews = rows.map((row) =>
    mapRowToFacultyView(row, trendByFaculty.get(row.dimension_id) ?? [])
  );

  const interventionStats = await getInterventionStatsForRoleScopeFromDb({
    role: "superadmin",
    interventionType: "all",
  });

  return { facultyViews, snapshotDate, trendDates, interventionStats };
}

export default async function SuperadminEffectivenessPage() {
  const { facultyViews, snapshotDate, trendDates, interventionStats } =
    await loadFacultyEffectiveness();

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
          Effectiveness Index
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Official EI criteria — log-in rate, attendance posting, faculty intervention, and
          wellbeing process across all faculties.
        </p>
      </div>

      <FEIDashboardClient
        faculties={facultyViews}
        snapshotDate={snapshotDate}
        trendDates={trendDates}
        interventionStats={interventionStats}
      />
    </div>
  );
}
