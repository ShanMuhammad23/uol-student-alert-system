"use client";

import { useMemo } from "react";

import { InterventionStatusChart } from "@/components/Charts/intervention-status-chart/chart";
import type { EnrollmentRecord } from "@/lib/enrollment";
import { cn } from "@/lib/utils";
import {
  getAttendanceAlertLevel,
  normalizeCourseCode,
} from "@/lib/attendance-utils";

import { StudentCourseAttendanceDetails } from "./StudentCourseAttendanceDetails";

type SectionKind = "badges" | "analytics";

type Props = {
  sapId: string;
  section: SectionKind;
  enrollmentRecords?: EnrollmentRecord[];
  dbMetricRows?: {
    courseId: string;
    courseTitle: string | null;
    sectionCode: string | null;
    instructorName: string | null;
    totalClassesHeld: number;
    attendanceMarkedClasses: number;
    classesAttended: number;
    attendancePercentage: number | null;
    classAverageAttendance: number | null;
    attendanceAlertLevel: "warning" | "critical" | null;
    gpaCurrent: number | null;
    gpaAlertLevel: "warning" | "critical" | null;
  }[];
  selectedCourseCode?: string;
  selectedSection?: string;
  currentCgpa?: number | null;
  gpaPrevious?: number | null;
  gpaChange?: number | null;
  gpaTrendLevel?: "warning" | "critical" | null;
  gpaTrendSeries?: { key?: string; label?: string; x?: string; value?: number; y?: number }[];
  selectedClassAverage?: number | null;
};

const EMPTY_ATTENDANCE = {
  total_classes_held: 0,
  classes_attended: 0,
  attendance_percentage: 0,
  class_average_attendance: 0,
};

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
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-white animate-pulse",
          level === "none" && "hidden"
        )}
      />
      {label}
    </span>
  );
}

function getWorstLevel(
  levels: Array<"critical" | "warning" | null | undefined>
): "critical" | "warning" | "none" {
  if (levels.some((l) => l === "critical")) return "critical";
  if (levels.some((l) => l === "warning")) return "warning";
  return "none";
}

export function StudentMetricsClient({
  sapId,
  section,
  enrollmentRecords = [],
  dbMetricRows = [],
  selectedCourseCode,
  selectedSection,
  currentCgpa = null,
  gpaPrevious = null,
  gpaChange = null,
  gpaTrendLevel = null,
  gpaTrendSeries = [],
  selectedClassAverage = null,
}: Props) {
  const isLoading = false;
  const studentRows = dbMetricRows;
  const focusedCourseRows = useMemo(() => {
    if (!studentRows.length) return [];
    if (!selectedCourseCode) return [studentRows[0]];
    const targetCourse = normalizeCourseCode(selectedCourseCode);
    const matches = studentRows.filter((r) => {
      const courseMatches =
        normalizeCourseCode(String(r.courseId ?? "")) === targetCourse;
      const sectionMatches =
        !selectedSection || (r.sectionCode ?? "") === selectedSection;
      return courseMatches && sectionMatches;
    });
    return matches.length ? matches : [studentRows[0]];
  }, [studentRows, selectedCourseCode, selectedSection]);

  const worstGpaLevel = useMemo(() => {
    if (gpaTrendLevel === "critical") return "critical";
    if (gpaTrendLevel === "warning") return "warning";
    return getWorstLevel(studentRows.map((r) => r.gpaAlertLevel));
  }, [studentRows, gpaTrendLevel]);
  const selectedCourseAttendanceLevel = useMemo(() => {
    const levels = focusedCourseRows
      .map((r) =>
        getAttendanceAlertLevel(
          Number(r.attendancePercentage ?? NaN),
          selectedClassAverage ?? r.classAverageAttendance ?? null,
          r.attendanceMarkedClasses ?? r.totalClassesHeld
        )
      )
      .filter((level): level is "critical" | "warning" => level != null);

    return getWorstLevel(levels);
  }, [
    focusedCourseRows,
    selectedClassAverage,
  ]);
  const badgeAttendanceLevel = selectedCourseAttendanceLevel;
  const student = useMemo(
    () => {
      if (!studentRows.length) return null;
      return focusedCourseRows[0] ?? studentRows[0];
    },
    [studentRows, focusedCourseRows, sapId]
  );

  if (section === "badges") {
    if (isLoading) {
      return (
        <div className="flex gap-3">
          <AlertBadge level="none" label="Attendance: Loading" />
          <AlertBadge level="none" label="GPA: Loading" />
        </div>
      );
    }

    return (
      <div className="flex gap-3">
        <AlertBadge
          level={badgeAttendanceLevel}
          label={`Attendance: ${
            badgeAttendanceLevel === "critical"
              ? "Red"
              : badgeAttendanceLevel === "warning"
              ? "Yellow"
              : "Normal"
          }`}
        />
        <AlertBadge
          level={worstGpaLevel}
          label={`GPA: ${
            worstGpaLevel === "critical"
              ? "Red"
              : worstGpaLevel === "warning"
              ? "Yellow"
              : "Normal"
          }`}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-dark text-sm text-neutral-500">
          Loading attendance metrics...
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-dark text-sm text-neutral-500">
          Loading GPA metrics...
        </div>
      </div>
    );
  }

  const overallAttendance = student
    ? {
        total_classes_held: student.totalClassesHeld,
        classes_attended: student.classesAttended,
        attendance_percentage: student.attendancePercentage ?? 0,
        class_average_attendance: student.classAverageAttendance ?? 0,
      }
    : EMPTY_ATTENDANCE;

  const currentGpaValue = currentCgpa ?? student?.gpaCurrent ?? 0;
  const previousGpaValue = gpaPrevious ?? 0;
  const changeValue =
    typeof gpaChange === "number"
      ? Number(gpaChange.toFixed(2))
      : Number((currentGpaValue - previousGpaValue).toFixed(2));
  const chartSeries = gpaTrendSeries
    .map((p) => {
      const x = p.label ?? p.x ?? p.key ?? "";
      const y = typeof p.value === "number" ? p.value : p.y;
      if (!x || typeof y !== "number" || !Number.isFinite(y)) return null;
      return { x, y };
    })
    .filter((p): p is { x: string; y: number } => p != null);
  const attendanceAlert =
    selectedCourseAttendanceLevel && selectedCourseAttendanceLevel !== "none"
      ? selectedCourseAttendanceLevel
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-dark">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Attendance</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Performance vs class average</p>
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl text-2xl",
              attendanceAlert === "critical"
                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                : attendanceAlert === "warning"
                ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
            )}
          >
            📅
          </div>
        </div>
        <StudentCourseAttendanceDetails
          enrollmentRecords={enrollmentRecords}
          dbMetricRows={dbMetricRows}
          selectedCourseCode={selectedCourseCode}
          selectedSection={selectedSection}
          overallAttendance={overallAttendance}
          attendanceAlertLevel={attendanceAlert}
          monitoringClassAverage={
            selectedClassAverage ??
            student?.classAverageAttendance ??
            null
          }
        />
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-dark">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">GPA</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Academic performance tracking</p>
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl text-2xl",
              currentGpaValue < 2
                ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                : currentGpaValue < 3
                ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
            )}
          >
            🎓
          </div>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
           
            <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
              <p className="text-xl font-bold text-gray-700 dark:text-gray-400">{previousGpaValue.toFixed(2)}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Previous</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-900/20">
              <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{currentGpaValue.toFixed(2)}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600/70">Current</p>
            </div>
            <div className={cn("rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-900/20", changeValue > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400")}>
              <p className={cn("text-xl font-bold", changeValue > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                {changeValue > 0 ? "+" : ""}
                {changeValue.toFixed(2)}
              </p>
              <p className={cn("text-[10px] font-medium uppercase tracking-wide", changeValue > 0 ? "text-emerald-600/70" : "text-red-600/70")}>Change</p>
            </div>
          </div>

          {chartSeries.length ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <InterventionStatusChart
                data={chartSeries}
                title="GPA Trend"
              />
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No GPA history available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

