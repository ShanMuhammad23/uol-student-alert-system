import {
  getOverviewData,
  getCurrentUser,
  getSuperadminFacultyStats,
  getSuperadminAlertSnapshotTrend,
  getInterventionChartData,
  getWellbeingChartData,
} from "@/app/(home)/dashboard/fetch";
import { AlertSnapshotsLineChart } from "./_components/AlertSnapshotsLineChart";
import { InterventionStatusChart } from "@/components/Charts/intervention-status-chart/chart";
import { StatusStackedChart } from "@/components/Charts/status-stacked-chart/chart";
import Link from "next/link";
const FACULTY_NAME_FALLBACK: Record<string, string> = {
  "50000178": "Faculty of Pharmacy",
  "50000172": "Faculty of Social Sciences",
};
function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "yellow" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600"
      : tone === "yellow"
      ? "text-yellow-500"
      : "text-dark dark:text-white";

  return (
    <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <p className="text-sm text-dark-5 dark:text-dark-6">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

type SuperadminPageProps = {
  searchParams: Promise<{ faculty?: string }>;
};

export default async function SuperadminDashboardPage({
  searchParams,
}: SuperadminPageProps) {
  const user = await getCurrentUser();
  const resolvedSearchParams = await searchParams;
  const selectedFaculty = resolvedSearchParams.faculty?.trim() || "";
  const [overview, facultyStats, interventionChart, wellbeingChart] = await Promise.all([
    getOverviewData(user),
    getSuperadminFacultyStats(),
    getInterventionChartData(user),
    getWellbeingChartData(user),
  ]);
  const validSelectedFaculty = facultyStats.some(
    (f) => f.facultyId === selectedFaculty
  )
    ? selectedFaculty
    : "";
  const snapshotTrend = await getSuperadminAlertSnapshotTrend(
    365,
    validSelectedFaculty || null
  );

  return (
    <div className="space-y-5">
     

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total Students"
          value={overview.totalStudents ?? 0}
          tone="neutral"
        />
        <MetricCard
          label="Attendance Yellow"
          value={overview.yellowAttendance?.value ?? 0}
          tone="yellow"
        />
        <MetricCard
          label="Attendance Red"
          value={overview.redAttendance?.value ?? 0}
          tone="red"
        />
        <MetricCard
          label="GPA Yellow"
          value={overview.yellowGpa?.value ?? 0}
          tone="yellow"
        />
        <MetricCard
          label="GPA Red"
          value={overview.redGpa?.value ?? 0}
          tone="red"
        />
      </div>
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-dark dark:text-white">
            Alerts Trend
          </h2>
          <form method="get" className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-dark-5 dark:text-dark-6">
              <span>Faculty</span>
              <select
                name="faculty"
                defaultValue={validSelectedFaculty}
                className="min-w-[230px] rounded-md border border-stroke bg-white px-2 py-1.5 text-sm text-dark outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              >
                <option value="">All Faculties</option>
                {facultyStats.map((f) => (
                  <option key={f.facultyId} value={f.facultyId}>
                    {FACULTY_NAME_FALLBACK[f.facultyId] ?? f.facultyName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="h-[36px] rounded-md border border-primary px-3 text-sm font-medium text-primary transition hover:bg-primary/10"
            >
              Apply
            </button>
          </form>
        </div>
        <AlertSnapshotsLineChart points={snapshotTrend} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <InterventionStatusChart
            title="Intervention Status (Global)"
            data={interventionChart.data}
            statusColors={interventionChart.statusColors}
          />
        </div>
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <StatusStackedChart
            title="Wellbeing Resolution (Global)"
            data={wellbeingChart}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Faculties
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {facultyStats.map((f) => (
            <Link
              key={f.facultyId}
              href={`/dashboard?as=dean&faculty=${encodeURIComponent(
                f.facultyId
              )}`}
              aria-label={`Open dean dashboard for ${f.facultyName}`}
              className="block rounded-[10px] bg-white p-5 shadow-1 transition-shadow hover:shadow-2xl dark:bg-gray-dark dark:shadow-card"
            >
              <p className="text-sm font-semibold text-dark dark:text-white">
                {FACULTY_NAME_FALLBACK[f.facultyId] ?? f.facultyName} ( {f.total.toLocaleString()})
              </p>
            
              
             
              <div className="mt-3 flex  gap-2 text-sm">
                <div className="flex gap-2 border-r-2 border-gray-200 pr-2">
                <p className="text-dark-5 dark:text-dark-6">
                  Att :{" "}
                  <span className="font-semibold text-yellow-500 border-r-2 border-gray-200 pr-2">
                    {f.yellowAttendance}
                  </span>
                </p>
                <p className="text-dark-5 dark:text-dark-6">
                 
                  <span className="font-semibold text-red-600">
                    {f.redAttendance}
                  </span>
                </p>
                </div>
                <div className="flex gap-2 ">
                <p className="text-dark-5 dark:text-dark-6">
                  GPA :{" "}
                  <span className="font-semibold text-yellow-500 border-r-2 border-gray-200 pr-2">
                    {f.yellowGpa}
                  </span>
                </p>
                <p className="text-dark-5 dark:text-dark-6">
                  GPA :{" "}
                  <span className="font-semibold text-red-600">
                    {f.redGpa}
                  </span>
                </p>
                </div>
                
              </div>
            </Link>
          ))}
        </div>
      </section>

     
    </div>
  );
}
