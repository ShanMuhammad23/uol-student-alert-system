"use client";

import { useMemo } from "react";

import { InterventionStatusChart } from "@/components/Charts/intervention-status-chart/chart";
import { useAttendanceAlerts } from "@/hooks/useAttendanceAlerts";
import { useMonitoringStudents } from "@/hooks/useMonitoringStudents";
import type { Student } from "@/app/(home)/dashboard/fetch";
import type { EnrollmentRecord } from "@/lib/enrollment";
import { cn } from "@/lib/utils";
import {
  getAttendanceAlertLevel,
  getEnrollmentAttendanceKey,
  normalizeCourseCode,
} from "@/lib/attendance-utils";

import { StudentCourseAttendanceDetails } from "./StudentCourseAttendanceDetails";

type SectionKind = "badges" | "analytics";

type Props = {
  sapId: string;
  section: SectionKind;
  enrollmentRecords?: EnrollmentRecord[];
  selectedCourseCode?: string;
  selectedSection?: string;
  currentCgpa?: number | null;
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

function selectStudent(rows: Student[], sapId: string): Student | null {
  for (const row of rows) {
    if (String(row.sap_id).trim() === String(sapId).trim()) return row;
  }
  return null;
}

function selectStudentForCourse(
  rows: Student[],
  sapId: string,
  selectedCourseCode?: string
): Student | null {
  const sap = String(sapId).trim();
  const studentRows = rows.filter((r) => String(r.sap_id).trim() === sap);
  if (!studentRows.length) return null;
  if (!selectedCourseCode) return studentRows[0];
  const targetCourse = normalizeCourseCode(selectedCourseCode);
  return (
    studentRows.find(
      (r) => normalizeCourseCode(String(r.course_id ?? "")) === targetCourse
    ) ?? studentRows[0]
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
  selectedCourseCode,
  selectedSection,
  currentCgpa = null,
  selectedClassAverage = null,
}: Props) {
  const { data, isLoading } = useMonitoringStudents();
  const { attendanceSummaries, classAverageByCourseSection } =
    useAttendanceAlerts(enrollmentRecords);
  const studentRows = useMemo(
    () =>
      (data?.students ?? []).filter(
        (r) => String(r.sap_id).trim() === String(sapId).trim()
      ),
    [data?.students, sapId]
  );
  const worstAttendanceLevel = useMemo(
    () => getWorstLevel(studentRows.map((r) => r.attendance.alert_level)),
    [studentRows]
  );
  const worstGpaLevel = useMemo(
    () => getWorstLevel(studentRows.map((r) => r.gpa.alert_level)),
    [studentRows]
  );
  const selectedCourseAttendanceLevel = useMemo(() => {
    if (!attendanceSummaries || !enrollmentRecords.length) return null;

    const relevantRows = selectedCourseCode
      ? enrollmentRecords.filter((r) => {
          const courseMatches =
            normalizeCourseCode(
              typeof r.CrCode === "string" ? r.CrCode : String(r.CrCode ?? "")
            ) === normalizeCourseCode(selectedCourseCode);
          const sectionMatches =
            !selectedSection || (r.Section ?? "") === selectedSection;
          return courseMatches && sectionMatches;
        })
      : enrollmentRecords;

    const levels = relevantRows
      .map((row) => {
        const key = getEnrollmentAttendanceKey(row);
        const summary = attendanceSummaries.get(key);
        if (!summary) return null;

        const courseSectionKey = `${normalizeCourseCode(
          typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? "")
        )}__${row.Section ?? ""}`;
        const classAverage =
          selectedClassAverage ??
          classAverageByCourseSection.get(courseSectionKey) ??
          null;

        return getAttendanceAlertLevel(
          summary.percentage,
          classAverage,
          summary.totalHeld
        );
      })
      .filter((level): level is "critical" | "warning" => level != null);

    return getWorstLevel(levels);
  }, [
    attendanceSummaries,
    classAverageByCourseSection,
    enrollmentRecords,
    selectedClassAverage,
    selectedCourseCode,
    selectedSection,
  ]);
  const effectiveAttendanceLevel = useMemo(
    () =>
      getWorstLevel([
        worstAttendanceLevel === "none" ? null : worstAttendanceLevel,
        selectedCourseAttendanceLevel === "none"
          ? null
          : selectedCourseAttendanceLevel,
      ]),
    [selectedCourseAttendanceLevel, worstAttendanceLevel]
  );
  const student = useMemo(
    () => selectStudentForCourse(data?.students ?? [], sapId, selectedCourseCode),
    [data?.students, sapId, selectedCourseCode]
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
          level={effectiveAttendanceLevel}
          label={`Attendance: ${
            effectiveAttendanceLevel === "critical"
              ? "Red"
              : effectiveAttendanceLevel === "warning"
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
  const gpaTrendSeries =
    gpa?.history?.length && gpa.history.length > 0
      ? gpa.history.map((h) => ({ x: h.semester, y: h.gpa }))
      : currentCgpa != null
      ? [{ x: "Fall 2025", y: currentCgpa }]
      : [];
  const attendanceAlert =
    effectiveAttendanceLevel === "none" ? null : effectiveAttendanceLevel;

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
          attendanceAlertLevel={attendanceAlert}
          monitoringClassAverage={
            selectedClassAverage ??
            student?.attendance.class_average_attendance ??
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

          {gpaTrendSeries.length ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <InterventionStatusChart
                data={gpaTrendSeries}
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

