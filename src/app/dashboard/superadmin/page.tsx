import {
  getOverviewData,
  getCurrentUser,
  getSuperadminFacultyStats,
  getSuperadminAlertSnapshotTrend,
  getInterventionChartData,
  getWellbeingChartData,
} from "@/app/(home)/dashboard/fetch";
import { InterventionStatusChart } from "@/components/Charts/intervention-status-chart/chart";
import { StatusStackedChart } from "@/components/Charts/status-stacked-chart/chart";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SuperadminAlertTrendsCollapsible } from "./_components/SuperadminAlertTrendsCollapsible";

// ─── Modern Metric Card ────────────────────────────────────────────
function MetricCard({
  label,
  value,
  tone,
  subtitle,
  percentBadge,
}: {
  label: string;
  value: number;
  tone: "neutral" | "yellow" | "red" | "emerald";
  subtitle?: string;
  /** Share of total students, shown as a pill (e.g. "12.4%"). */
  percentBadge?: string | null;
}) {
  const toneStyles = {
    neutral: "bg-slate-50 border-slate-200 text-slate-900 dark:bg-slate-800/50 dark:border-slate-700 dark:text-white",
    yellow: "bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100",
    red: "bg-red-50/80 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100",
    emerald: "bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-100",
  };

  const valueStyles = {
    neutral: "text-slate-900 dark:text-white",
    yellow: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
  };

  const barColors = {
    neutral: "bg-slate-300 dark:bg-slate-600",
    yellow: "bg-amber-400 dark:bg-amber-500",
    red: "bg-red-500 dark:bg-red-500",
    emerald: "bg-emerald-500 dark:bg-emerald-500",
  };

  const badgeStyles = {
    neutral:
      "bg-slate-200/90 text-slate-800 ring-1 ring-slate-300/80 dark:bg-slate-700/90 dark:text-slate-100 dark:ring-slate-600",
    yellow:
      "bg-amber-200/90 text-amber-950 ring-1 ring-amber-400/50 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-600/40",
    red: "bg-red-200/90 text-red-950 ring-1 ring-red-400/50 dark:bg-red-950/50 dark:text-red-100 dark:ring-red-600/40",
    emerald:
      "bg-emerald-200/90 text-emerald-950 ring-1 ring-emerald-400/50 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-600/40",
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-5 transition-all hover:shadow-md",
      toneStyles[tone]
    )}>
      {/* Subtle top accent bar */}
      <div className={cn("absolute left-0 right-0 top-0 h-1", barColors[tone])} />

      <div className="pt-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 text-sm font-bold uppercase leading-snug tracking-wide",
              tone === "neutral" ? "text-slate-800 dark:text-white" : ""
            )}
          >
            {label}
          </p>
          {percentBadge ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                badgeStyles[tone]
              )}
            >
              {percentBadge}
            </span>
          ) : null}
        </div>
        <p className={cn("mt-3 text-3xl font-bold tabular-nums tracking-tight", valueStyles[tone])}>
          {value.toLocaleString()}
        </p>
        {subtitle ? (
          <p className="mt-1.5 text-xs font-medium text-slate-600/90 dark:text-slate-300/90">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Faculty Card ──────────────────────────────────────────────────
function FacultyCard({ faculty }: { faculty: Awaited<ReturnType<typeof getSuperadminFacultyStats>>[number] }) {
  const totalAlerts = faculty.yellowAttendance + faculty.redAttendance + faculty.yellowGpa + faculty.redGpa;
  const alertRate = faculty.total > 0 ? (totalAlerts / faculty.total) * 100 : 0;

  return (
    <Link
      href={`/dashboard?as=dean&faculty=${encodeURIComponent(faculty.facultyId)}`}
      className="group relative block rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-emerald-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-emerald-700"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 flex gap-2 items-center">
          <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-600 dark:text-white dark:group-hover:text-emerald-400">
            {resolveFacultyNameFromIdOrName(faculty.facultyId, faculty.facultyName.replace("Faculty of ", "")) ?? faculty.facultyId}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            ({faculty.total.toLocaleString()})
          </p>
        </div>
        <span className={cn(
          "shrink-0 rounded-tr-xl px-2.5 py-1 text-xs font-bold tabular-nums absolute top-0 right-0",
          alertRate > 10
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : alertRate > 5
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        )}>
          {alertRate.toFixed(1)}%
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Attendance */}
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Attendance
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-lg font-bold text-amber-500 dark:text-amber-400">
              {faculty.yellowAttendance}
            </span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="text-lg font-bold text-red-500 dark:text-red-400">
              {faculty.redAttendance}
            </span>
          </div>
        </div>

        {/* GPA */}
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            SGPA
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-lg font-bold text-amber-500 dark:text-amber-400">
              {faculty.yellowGpa}
            </span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="text-lg font-bold text-red-500 dark:text-red-400">
              {faculty.redGpa}
            </span>
          </div>
        </div>
      </div>

   
    </Link>
  );
}

// ─── Section Header ────────────────────────────────────────────────
function SectionHeader({ 
  title, 
  action 
}: { 
  title: string; 
  action?: React.ReactNode 
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      {action && <div className="flex items-center gap-2">{action}</div>}
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
  ) ? selectedFaculty : "";
  
  const snapshotTrend = await getSuperadminAlertSnapshotTrend(
    365,
    validSelectedFaculty || null
  );

  const totalStudents = overview.totalStudents ?? 0;
  const shareOfTotal = (count: number) =>
    totalStudents > 0 ? `${((count / totalStudents) * 100).toFixed(1)}%` : "0.0%";

  return (
    <div className="mx-auto  space-y-8 pb-8">
      {/* ─── KPI Stats Row ───────────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Total Students"
            value={totalStudents}
            tone="neutral"
            subtitle="Tracked cohort"
            percentBadge={totalStudents > 0 ? "100%" : null}
          />
          <MetricCard
            label="Att. Yellow"
            value={overview.yellowAttendance?.value ?? 0}
            tone="yellow"
            subtitle="20% < CA"
            percentBadge={shareOfTotal(overview.yellowAttendance?.value ?? 0)}
          />
          <MetricCard
            label="Att. Red"
            value={overview.redAttendance?.value ?? 0}
            tone="red"
            subtitle="≤60%"
            percentBadge={shareOfTotal(overview.redAttendance?.value ?? 0)}
          />
          <MetricCard
            label="SGPA Yellow"
            value={overview.yellowGpa?.value ?? 0}
            tone="yellow"
            subtitle="1.0 Drop"
            percentBadge={shareOfTotal(overview.yellowGpa?.value ?? 0)}
          />
          <MetricCard
            label="SGPA Red"
            value={overview.redGpa?.value ?? 0}
            tone="red"
            subtitle="1.5 Drop"
            percentBadge={shareOfTotal(overview.redGpa?.value ?? 0)}
          />
        </div>
      </section>

      {/* ─── Intervention + Wellbeing (one row) ───────────────────── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
          <SectionHeader
            title="Intervention Status"
            action={
              <Link
                href="/dashboard/superadmin/interventions"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
              >
                See All Interventions
                <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            }
          />
          <div className="mt-4">
            <InterventionStatusChart
              title=""
              data={interventionChart.data}
              statusColors={interventionChart.statusColors}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
          <SectionHeader title="Wellbeing Resolution" />
          <div className="mt-4">
            <StatusStackedChart title="" data={wellbeingChart} />
          </div>
        </div>
      </section>

      {/* ─── Alert snapshot (full width, collapsible, closed by default) ─ */}
      <section className="w-full">
        <SuperadminAlertTrendsCollapsible
          points={snapshotTrend}
          facultyOptions={facultyStats.map((f) => ({
            facultyId: f.facultyId,
            facultyName: f.facultyName,
          }))}
          validSelectedFaculty={validSelectedFaculty}
        />
      </section>

      {/* ─── Faculties Grid ──────────────────────────────────────── */}
      <section>
        <SectionHeader title="Faculty Overview" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facultyStats.map((f) => (
            <FacultyCard key={f.facultyId} faculty={f} />
          ))}
        </div>
      </section>
    </div>
  );
}