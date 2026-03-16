import { getStudentBySapId, generateAlertReport } from "@/app/(home)/dashboard/fetch";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { InterventionStatusChart } from "@/components/Charts/intervention-status-chart/chart";
import { InterventionHistorySection } from "./_components/InterventionHistorySection";
import {
  getActionsByStudentSapId,
  getActionTypeLabel,
  getActionResultLabel,
} from "@/data/student-actions";
import { getMergedActionsByStudentSapId } from "@/data/student-actions-store";
import { getInterventionsByStudentSapId } from "@/data/intervention-store";
import { readFile } from "fs/promises";
import path from "path";
import type { EnrollmentRecord } from "@/lib/enrollment";
import { StudentCourseAttendanceDetails } from "./_components/StudentCourseAttendanceDetails";
import { pool } from "@/lib/db";

type PropsType = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; course?: string; section?: string }>;
};

async function getEnrollmentForStudentSapId(
  sapId: string
): Promise<EnrollmentRecord[]> {
  const dataPath = path.join(process.cwd(), "public", "enrollment_data.json");
  const raw = await readFile(dataPath, "utf-8");
  const data = JSON.parse(raw) as EnrollmentRecord[];
  if (!Array.isArray(data)) return [];
  return data.filter((r) => r.SapNo === sapId);
}

export async function generateMetadata({ params }: PropsType): Promise<Metadata> {
  const { id } = await params;
  const student = await getStudentBySapId(id);
  return {
    title: student ? `${student.name} | Student Profile` : "Student not found",
  };
}

// Alert Badge Component
function AlertBadge({ level, label }: { level: string; label: string }) {
  const styles = {
    critical: "bg-red-500 text-white border-red-600 shadow-red-200",
    warning: "bg-amber-500 text-white border-amber-600 shadow-amber-200",
    none: "bg-emerald-500 text-white border-emerald-600 shadow-emerald-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm",
        styles[level as keyof typeof styles] || styles.none
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-white animate-pulse", level === "none" && "hidden")} />
      {label}
    </span>
  );
}

// Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  trend,
  alert,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  alert?: "critical" | "warning" | "none";
  icon: string;
}) {
  const trendColors = {
    up: "text-emerald-600",
    down: "text-red-500",
    neutral: "text-gray-500",
  };

  const alertBorders = {
    critical: "border-l-4 border-l-red-500",
    warning: "border-l-4 border-l-amber-500",
    none: "border-l-4 border-l-emerald-500",
  };

  const alertBg = {
    critical: "bg-red-50 dark:bg-red-900/20",
    warning: "bg-amber-50 dark:bg-amber-900/20",
    none: "bg-emerald-50 dark:bg-emerald-900/20",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-5 shadow-sm transition-shadow hover:shadow-md",
        alertBorders[alert || "none"],
        alertBg[alert || "none"]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-900 dark:text-white">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {value}
            </span>
            {trend && (
              <span className={cn("text-sm font-medium text-gray-900 dark:text-white", trendColors[trend])}>
                {trend === "up" ? "↗" : trend === "down" ? "↘" : "→"}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-900 dark:text-white">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg dark:bg-white ml-4">
          {icon}
        </div>
      </div>
    </div>
  );
}

// Progress Bar Component
function ProgressBar({
  value,
  max,
  label,
  comparison,
  type = "neutral",
}: {
  value: number;
  max: number;
  label: string;
  comparison?: number;
  type?: "success" | "warning" | "danger" | "neutral";
}) {
  const percentage = (value / max) * 100;
  const barColors = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    neutral: "bg-blue-500",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-bold",
              type === "danger" && "text-red-600 dark:text-red-400",
              type === "warning" && "text-amber-600 dark:text-amber-400",
              type === "success" && "text-emerald-600 dark:text-emerald-400",
              type === "neutral" && "text-gray-900 dark:text-white"
            )}
          >
            {value.toFixed(1)}%
          </span>
          {comparison !== undefined && (
            <span
              className={cn(
                "text-xs font-medium",
                comparison >= 0 ? "text-emerald-600" : "text-red-500"
              )}
            >
              ({comparison >= 0 ? "+" : ""}
              {comparison.toFixed(1)}%)
            </span>
          )}
        </div>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColors[type])}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {comparison !== undefined && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Class Average</span>
          <span>{(value - comparison).toFixed(1)}% </span>
        </div>
      )}
    </div>
  );
}

export default async function StudentPage({ params, searchParams }: PropsType) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const returnToUrl =
    resolvedSearchParams.from && resolvedSearchParams.from.startsWith("/")
      ? resolvedSearchParams.from
      : "/";
  const selectedCourseCode = resolvedSearchParams.course;
  const selectedSection = resolvedSearchParams.section;
  const student = await getStudentBySapId(id);
  if (!student) notFound();

  const report = generateAlertReport(student);

  const actionHistory = getMergedActionsByStudentSapId(student.sap_id);
  const sapIdFromUrl = id;
  const interventionHistory = await getInterventionsByStudentSapId(sapIdFromUrl);

  // Calculate metrics
  const attendanceDiff =
    student.attendance.attendance_percentage - student.attendance.class_average_attendance;
  const gpaDiff = student.gpa.current - (report.gpa_comparison.class_average_current || 0);

  const enrollmentRecords = await getEnrollmentForStudentSapId(sapIdFromUrl);
  const primaryEnrollment = enrollmentRecords[0] ?? null;

  let facultyName: string | null = null;
  const facultyId = primaryEnrollment?.FacId ?? student.faculty_id;
  if (facultyId && pool) {
    try {
      const res = await pool.query<{ name: string }>(
        "SELECT name FROM faculties WHERE id = $1",
        [facultyId]
      );
      facultyName = res.rows[0]?.name?.trim() ?? null;
    } catch {
      facultyName = null;
    }
  }
  if (facultyId && !facultyName) facultyName = `Faculty ${facultyId}`;

  const courseSummaries = (() => {
    const map = new Map<
      string,
      { code: string; title: string; teacher: string | null }
    >();
    for (const r of enrollmentRecords) {
      const code = r.CrCode ?? "";
      const title = r.CrTitle ?? "";
      const key = code || title;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          code: code || "—",
          title: title || "—",
          teacher: r.Teacher ?? null,
        });
      }
    }
    return Array.from(map.values());
  })();

  return (
    <div className="w-full space-y-6 mt-4">
      {/* Back to list / Dashboard */}
      <div className="flex items-center gap-2">
        <Link
          href={returnToUrl}
          className="inline-flex items-center gap-2 text-lg font-medium text-primary hover:underline"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to list
        </Link>
      </div>

      {/* Profile Hero Card */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#1f4a3d] via-[#255a4a] to-[#1f4a3d] shadow-lg dark:bg-gray-dark">
        <div className="relative px-6 py-8 sm:px-8">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white blur-3xl" />
          </div>
          
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            
            <div className="flex-1 text-white">
              <h1 className="text-2xl font-bold sm:text-3xl">
                {primaryEnrollment?.Name ?? student.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-white">
                <span className="flex  flex-col gap-1.5 border-r border-white/20 pr-4">
                  <span className="text-base">SAP ID:</span>
                  <span className="text-base font-medium">
                    {primaryEnrollment?.SapNo ?? sapIdFromUrl}
                  </span>
                </span>
                <span className="flex  flex-col gap-1.5 border-r border-white/20 pr-4">
                  <span className="text-base">Program:</span>
                  <span className="font-medium">
                    {primaryEnrollment?.DegreeTitle ??
                      primaryEnrollment?.DegreeCode ??
                      student.course_id}
                  </span>
                </span>
                <span className="flex  flex-col gap-1.5 border-r border-white/20 pr-4">
                  <span className="font-medium">
                    {facultyName ?? "—"}
                  </span>
                </span>
                <span className="flex  flex-col gap-1.5 ">
                  <span className="text-base">Department:</span>
                  <span className="font-medium">
                    {primaryEnrollment?.DeptName ?? student.department_id}
                  </span>
                </span>
              </div>
            </div>
            {/* <MetricCard
            title="Attendance vs Avg"
            value={`${attendanceDiff >= 0 ? "+" : ""}${attendanceDiff.toFixed(1)}%`}
            subtitle={`Class avg: ${student.attendance.class_average_attendance.toFixed(1)}%`}
            trend={attendanceDiff >= 0 ? "up" : "down"}
            alert={
              student.attendance.alert_level === "critical"
                ? "critical"
                : student.attendance.alert_level === "warning"
                  ? "warning"
                  : "none"
            }
            icon="👥"
          /> */}
            <div className="flex gap-3">
             
              <AlertBadge
                level={student.attendance.alert_level || "none"}
                label={`Att: ${student.attendance.alert_level === "critical" ? "Red" : student.attendance.alert_level === "warning" ? "Yellow" : "Normal"}`}
              />
               <AlertBadge
                level={student.gpa.alert_level || "none"}
                label={`GPA: ${student.gpa.alert_level === "critical" ? "Red" : student.gpa.alert_level === "warning" ? "Yellow" : "Normal"}`}
              />
            </div>
          </div>
        </div>

    
      </div>

      {/* Analytics Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance Analytics */}
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-dark">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Attendance
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Performance vs class average
              </p>
            </div>
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl text-2xl",
                student.attendance.alert_level === "critical"
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  : student.attendance.alert_level === "warning"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
              )}
            >
              📅
            </div>
          </div>

          <StudentCourseAttendanceDetails
            enrollmentRecords={enrollmentRecords}
            selectedCourseCode={selectedCourseCode}
            selectedSection={selectedSection}
            overallAttendance={{
              total_classes_held: student.attendance.total_classes_held,
              classes_attended: student.attendance.classes_attended,
              attendance_percentage: student.attendance.attendance_percentage,
              class_average_attendance: student.attendance.class_average_attendance,
            }}
          />
        </div>

        {/* GPA Analytics */}
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-dark">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                GPA 
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Academic performance tracking
              </p>
            </div>
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl text-2xl",
                student.gpa.current < 2.0
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                  : student.gpa.current < 3.0
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                  : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
              )}
            >
              🎓
            </div>
          </div>

          <div className="space-y-6">
            {/* GPA drop: <0.5 green, 0.5–<1 yellow, >=1 red */}
            {(() => {
              const drop = student.gpa.change <= 0 ? Math.abs(student.gpa.change) : 0;
              const changeCardType = drop >= 1 ? "red" : drop >= 0.5 ? "yellow" : "green";
              const changeBg = {
                red: "bg-red-50 dark:bg-red-900/20",
                yellow: "bg-amber-50 dark:bg-amber-900/20",
                green: "bg-emerald-50 dark:bg-emerald-900/20",
              };
              const changeText = {
                red: "text-red-700 dark:text-red-400",
                yellow: "text-amber-700 dark:text-amber-400",
                green: "text-emerald-700 dark:text-emerald-400",
              };
              const changeSub = {
                red: "text-red-600/70 dark:text-red-400/70",
                yellow: "text-amber-600/70 dark:text-amber-400/70",
                green: "text-emerald-600/70 dark:text-emerald-400/70",
              };
              return (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-900/20">
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                  {student.gpa.current}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600/70">
                  Current
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
                <p className="text-xl font-bold text-gray-700 dark:text-gray-400">
                  {student.gpa.previous}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  Previous
                </p>
              </div>
              <div className={cn("rounded-xl p-3 text-center", changeBg[changeCardType])}>
                <p className={cn("text-xl font-bold", changeText[changeCardType])}>
                  {student.gpa.change > 0 ? "+" : ""}
                  {student.gpa.change}
                </p>
                <p className={cn("text-[10px] font-medium uppercase tracking-wide", changeSub[changeCardType])}>
                  Change
                </p>
              </div>
            </div>
              );
            })()}

         

            {report.gpa_comparison.history && report.gpa_comparison.history.length > 0 && (
              <div>
               
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                  <InterventionStatusChart
                    data={report.gpa_comparison.history.map((h) => ({
                      x: h.semester,
                      y: h.gpa,
                    }))}
                    title="GPA Trend"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Intervention History (table + Add Intervention dialog) */}
      <InterventionHistorySection
        interventions={interventionHistory}
        studentSapId={sapIdFromUrl}
      />

     
    </div>
  );
}