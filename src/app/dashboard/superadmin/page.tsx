import {
  getOverviewData,
  getCurrentUser,
  getSuperadminFacultyStats,
  getSuperadminAlertSnapshotTrend,
} from "@/app/(home)/dashboard/fetch";
import { AlertSnapshotsLineChart } from "./_components/AlertSnapshotsLineChart";

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

export default async function SuperadminDashboardPage() {
  const user = await getCurrentUser();
  const [overview, facultyStats, snapshotTrend] = await Promise.all([
    getOverviewData(user),
    getSuperadminFacultyStats(),
    getSuperadminAlertSnapshotTrend(60),
  ]);

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
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Faculties
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {facultyStats.map((f) => (
            <div
              key={f.facultyId}
              className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card"
            >
              <p className="text-sm font-semibold text-dark dark:text-white">
                {f.facultyName}
              </p>
              <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
                {f.facultyId}
              </p>
              <p className="mt-3 text-2xl font-bold text-dark dark:text-white">
                {f.total.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
                Students
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <p className="text-dark-5 dark:text-dark-6">
                  Att Y:{" "}
                  <span className="font-semibold text-yellow-500">
                    {f.yellowAttendance}
                  </span>
                </p>
                <p className="text-dark-5 dark:text-dark-6">
                  Att R:{" "}
                  <span className="font-semibold text-red-600">
                    {f.redAttendance}
                  </span>
                </p>
                <p className="text-dark-5 dark:text-dark-6">
                  GPA Y:{" "}
                  <span className="font-semibold text-yellow-500">
                    {f.yellowGpa}
                  </span>
                </p>
                <p className="text-dark-5 dark:text-dark-6">
                  GPA R:{" "}
                  <span className="font-semibold text-red-600">
                    {f.redGpa}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Alerts Trend
        </h2>
        <AlertSnapshotsLineChart points={snapshotTrend} />
      </section>
    </div>
  );
}
