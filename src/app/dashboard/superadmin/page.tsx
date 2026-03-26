import { getOverviewData, getCurrentUser } from "@/app/(home)/dashboard/fetch";

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
  const overview = await getOverviewData(user);

  return (
    <div className="space-y-5">
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h1 className="text-2xl font-bold text-dark dark:text-white">
          Superadmin Dashboard
        </h1>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Role-restricted dashboard for platform-level monitoring.
        </p>
      </div>

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
    </div>
  );
}
