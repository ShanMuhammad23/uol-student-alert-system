"use client";

import { useMemo } from "react";

import { InterventionStatusChart } from "@/components/Charts/intervention-status-chart/chart";
import { useMonitoringStudents } from "@/hooks/useMonitoringStudents";
import type { Student } from "@/app/(home)/dashboard/fetch";
import type { EnrollmentRecord } from "@/lib/enrollment";
import { cn } from "@/lib/utils";

import { StudentCourseAttendanceDetails } from "./StudentCourseAttendanceDetails";

type SectionKind = "badges" | "analytics";

type Props = {
  sapId: string;
  section: SectionKind;
  enrollmentRecords?: EnrollmentRecord[];
  selectedCourseCode?: string;
  selectedSection?: string;
  currentCgpa?: number | null;
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

function selectStudent(rows: Student[], sapId: string): Student | null {
  for (const row of rows) {
    if (String(row.sap_id).trim() === String(sapId).trim()) return row;
  }
  return null;
}

export function StudentMetricsClient({
  sapId,
  section,
  enrollmentRecords = [],
  selectedCourseCode,
  selectedSection,
  currentCgpa = null,
}: Props) {
  const { data, isLoading } = useMonitoringStudents();
  const student = useMemo(
    () => selectStudent(data?.students ?? [], sapId),
    [data?.students, sapId]
  );

  if (section === "badges") {
    if (isLoading) {
      return (
        <div className="flex gap-3">
          <AlertBadge level="none" label="Att: Loading" />
          <AlertBadge level="none" label="GPA: Loading" />
        </div>
      );
    }
    return (
      <div className="flex gap-3">
        <AlertBadge
          level={student?.attendance.alert_level || "none"}
          label={`Att: ${
            student?.attendance.alert_level === "critical"
              ? "Red"
              : student?.attendance.alert_level === "warning"
              ? "Yellow"
              : "Normal"
          }`}
        />
        <AlertBadge
          level={student?.gpa.alert_level || "none"}
          label={`GPA: ${
            student?.gpa.alert_level === "critical"
              ? "Red"
              : student?.gpa.alert_level === "warning"
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
        total_classes_held: student.attendance.total_classes_held,
        classes_attended: student.attendance.classes_attended,
        attendance_percentage: student.attendance.attendance_percentage,
        class_average_attendance: student.attendance.class_average_attendance,
      }
    : EMPTY_ATTENDANCE;

  const gpa = student?.gpa;
  const currentGpaValue = currentCgpa ?? gpa?.current ?? 0;
  const previousGpaValue = gpa?.previous ?? 0;
  const changeValue = currentCgpa != null
    ? Number((currentGpaValue - previousGpaValue).toFixed(2))
    : (gpa?.change ?? 0);
  const attendanceAlert = student?.attendance.alert_level ?? null;

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
          selectedCourseCode={selectedCourseCode}
          selectedSection={selectedSection}
          overallAttendance={overallAttendance}
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
            <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-900/20">
              <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{currentGpaValue.toFixed(2)}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600/70">Current</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800">
              <p className="text-xl font-bold text-gray-700 dark:text-gray-400">{previousGpaValue.toFixed(2)}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Previous</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-900/20">
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {changeValue > 0 ? "+" : ""}
                {changeValue.toFixed(2)}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600/70">Change</p>
            </div>
          </div>

          {gpa?.history?.length ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <InterventionStatusChart
                data={gpa.history.map((h) => ({ x: h.semester, y: h.gpa }))}
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

