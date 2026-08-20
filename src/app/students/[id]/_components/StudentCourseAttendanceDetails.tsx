"use client";

import { useMemo } from "react";
import type { EnrollmentRecord } from "@/lib/enrollment";
import { cn } from "@/lib/utils";
import { formatAcademicTermLabel } from "@/lib/academic-term";
import {
  getEnrollmentAttendanceKey,
  normalizeCourseCode,
} from "@/lib/attendance-utils";
import { useAttendanceAlerts } from "@/hooks/useAttendanceAlerts";

type OverallAttendance = {
  total_classes_held: number;
  classes_attended: number;
  attendance_percentage: number;
  class_average_attendance: number;
};

type Props = {
  enrollmentRecords: EnrollmentRecord[];
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
    termLabel?: string | null;
    isCurrentTerm?: boolean;
    isActive?: boolean;
  }[];
  selectedCourseCode?: string;
  selectedSection?: string;
  overallAttendance: OverallAttendance;
  monitoringClassAverage?: number | null;
  attendanceAlertLevel?: "critical" | "warning" | null;
  /** No single course focus (e.g. wellbeing external direct case). */
  noFocusedCourse?: boolean;
  currentlyEnrolled?: boolean;
};

export function StudentCourseAttendanceDetails({
  enrollmentRecords,
  dbMetricRows = [],
  selectedCourseCode,
  selectedSection,
  overallAttendance,
  monitoringClassAverage = null,
  attendanceAlertLevel = null,
  noFocusedCourse = false,
  currentlyEnrolled = true,
}: Props) {
  const {
    attendanceSummaries,
    classAverageByCourseSection,
    monitoredByCourseSection,
  } = useAttendanceAlerts(enrollmentRecords);

  const {
    selectedSummary,
    selectedLabel,
    selectedInstructorName,
    selectedAttendanceKey,
    selectedDbRow,
  } = useMemo(() => {
    if (noFocusedCourse && dbMetricRows.length) {
      let totalHeld = 0;
      let marked = 0;
      let attended = 0;
      for (const r of dbMetricRows) {
        totalHeld += r.totalClassesHeld ?? 0;
        marked += r.attendanceMarkedClasses ?? 0;
        attended += r.classesAttended ?? 0;
      }
      const pct = marked > 0 ? (attended / marked) * 100 : 0;
      return {
        selectedSummary: {
          totalHeld,
          attendanceMarked: marked,
          attended,
          percentage: pct,
          absences: marked - attended,
        },
        selectedLabel: null,
        selectedInstructorName: null,
        selectedAttendanceKey: null,
        selectedDbRow: null,
      };
    }

    if (noFocusedCourse && !dbMetricRows.length) {
      const th = overallAttendance.total_classes_held;
      const att = overallAttendance.classes_attended;
      const posted = th;
      const pct = overallAttendance.attendance_percentage;
      return {
        selectedSummary: {
          totalHeld: th,
          attendanceMarked: posted,
          attended: att,
          percentage: pct,
          absences: posted - att,
        },
        selectedLabel: null,
        selectedInstructorName: null,
        selectedAttendanceKey: null,
        selectedDbRow: null,
      };
    }

    if (dbMetricRows.length) {
      const selected =
        (selectedCourseCode
          ? dbMetricRows.find((r) => {
              const courseMatches =
                normalizeCourseCode(String(r.courseId ?? "")) ===
                normalizeCourseCode(selectedCourseCode);
              const sectionMatches =
                !selectedSection || (r.sectionCode ?? "") === selectedSection;
              return courseMatches && sectionMatches;
            })
          : null) ?? dbMetricRows[0] ?? null;
      return {
        selectedSummary: selected
          ? {
              totalHeld: selected.totalClassesHeld,
              attendanceMarked: selected.attendanceMarkedClasses,
              attended: selected.classesAttended,
              percentage: selected.attendancePercentage ?? 0,
              absences:
                selected.attendanceMarkedClasses - selected.classesAttended,
            }
          : null,
        selectedLabel: selected
          ? `${selected.courseTitle ?? selected.courseId}${
              selected.sectionCode ? ` (${selected.sectionCode})` : ""
            }${
              selected.termLabel &&
              (currentlyEnrolled === false || selected.isCurrentTerm === false)
                ? ` · ${selected.termLabel}`
                : ""
            }`
          : null,
        selectedInstructorName: selected?.instructorName ?? null,
        selectedAttendanceKey: null,
        selectedDbRow: selected,
      };
    }

    if (!enrollmentRecords.length || !attendanceSummaries) {
      return {
        selectedSummary: null,
        selectedLabel: null,
        selectedInstructorName: null,
        selectedAttendanceKey: null,
        selectedDbRow: null,
      };
    }

    let target: EnrollmentRecord | null = null;
    if (selectedCourseCode) {
      const normSelected = normalizeCourseCode(selectedCourseCode);
      target =
        enrollmentRecords.find((r) => {
          const norm = normalizeCourseCode(
            typeof r.CrCode === "string" ? r.CrCode : String(r.CrCode ?? ""),
          );
          const sectionMatches =
            !selectedSection || (r.Section ?? "") === selectedSection;
          return norm === normSelected && sectionMatches;
        }) ?? null;
    }

    if (!target && !noFocusedCourse) {
      target = enrollmentRecords[0] ?? null;
    }
    if (!target) {
      return {
        selectedSummary: null,
        selectedLabel: null,
        selectedInstructorName: null,
        selectedAttendanceKey: null,
        selectedDbRow: null,
      };
    }

    const key = getEnrollmentAttendanceKey(target);
    const summary = attendanceSummaries.get(key) ?? null;
    const label = `${target.CrTitle ?? target.CrCode ?? "Course"}${
      target.Section ? ` (${target.Section})` : ""
    }`;

    return {
      selectedSummary: summary,
      selectedLabel: label,
      selectedInstructorName: target.Teacher ?? null,
      selectedAttendanceKey: key,
      selectedDbRow: null,
    };
  }, [
    dbMetricRows,
    attendanceSummaries,
    enrollmentRecords,
    selectedCourseCode,
    selectedSection,
    noFocusedCourse,
    overallAttendance,
    currentlyEnrolled,
  ]);
  const tableRows = useMemo(
    () =>
      enrollmentRecords.filter(
        (record) => getEnrollmentAttendanceKey(record) !== selectedAttendanceKey
      ),
    [enrollmentRecords, selectedAttendanceKey]
  );
  const dbTableRows = useMemo(() => {
    if (!dbMetricRows.length) return [];
    return dbMetricRows.filter((r) => r !== selectedDbRow);
  }, [dbMetricRows, selectedDbRow]);

  // Prefer per-course attendance metrics when available; otherwise fall back to overall.
  const displayTotalHeld =
    selectedSummary?.totalHeld ?? overallAttendance.total_classes_held;
  const displayAttended =
    selectedSummary?.attended ?? overallAttendance.classes_attended;
  const displayPosted =
    (selectedSummary as { attendanceMarked?: number } | null)
      ?.attendanceMarked ?? displayTotalHeld;
  const displayMissed = displayPosted - displayAttended;
  const displayPercentage =
    selectedSummary?.percentage ?? overallAttendance.attendance_percentage;
  // Use monitoring-derived class average for the selected student/course.
  // Recomputing from only this student's enrollment slice can collapse deviation to zero.
  const displayClassAvg =
    monitoringClassAverage ?? overallAttendance.class_average_attendance;
  const hasValidClassAvg =
    Number.isFinite(displayClassAvg) && displayClassAvg > 0;

  const comparison = hasValidClassAvg ? displayPercentage - displayClassAvg : 0;
  const isDanger = attendanceAlertLevel === "critical";
  const isWarning = attendanceAlertLevel === "warning";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        {selectedLabel && (
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Course focus:{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {selectedLabel}
            </span>
            {selectedInstructorName ? (
              <>
                {" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  - ( Instructor: {selectedInstructorName} )
                </span>
              </>
            ) : null}
          </p>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {noFocusedCourse
                ? "Overall attendance (all courses)"
                : "Attendance for this course"}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-bold",
                  isDanger && "text-red-600 dark:text-red-400",
                  isWarning && "text-amber-600 dark:text-amber-400",
                  !isDanger && !isWarning && "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {displayPercentage.toFixed(1)}%
              </span>
              {hasValidClassAvg && (
                <span
                  className="text-xs font-medium"
                  
                >
                ({comparison >= 0 ? "+" : ""}
                  {comparison.toFixed(1)}% vs class Avg: {displayClassAvg.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isDanger
                  ? "bg-red-500"
                  : isWarning
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(displayPercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
        <div className="text-center">
          <p className="text-2xl font-bold dark:text-green-500">
            {displayTotalHeld}
          </p>
          <p className="text-xs dark:text-green-500">Classes Held</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold dark:text-green-500">
            {displayPosted}
          </p>
          <p className="text-xs dark:text-green-500">Attendance Posted</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-500 dark:text-green-500">
            {displayAttended}
          </p>
          <p className="text-xs text-green-500 dark:text-green-500">
            Classes Attended
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-500 dark:text-red-500">
            {displayMissed}
          </p>
          <p className="text-xs text-red-500 dark:text-red-400">
            Classes Missed
          </p>
        </div>
      </div>

      {(dbTableRows.length > 0 || tableRows.length > 0) && (
        <div className="mt-2 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Attendance details (courses)
          </h4>
          {!currentlyEnrolled ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Historical intervention subject — semester is shown for each course.
            </p>
          ) : null}
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white/50 dark:border-gray-700 dark:bg-gray-900/20">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800">
                  <th className="px-4 py-2 font-semibold">Course - Code</th>
                  <th className="px-4 py-2 font-semibold">Semester</th>
                  <th className="px-4 py-2 font-semibold">Instructor</th>
                  <th className="px-4 py-2 font-semibold text-center">
                    Attendance
                  </th>
                </tr>
              </thead>
              <tbody>
                {(dbMetricRows.length ? [] : tableRows).map((r) => {
                  const key = getEnrollmentAttendanceKey(r);
                  const summary = attendanceSummaries?.get(key) ?? null;
                  const courseSectionKey = `${normalizeCourseCode(
                    typeof r.CrCode === "string"
                      ? r.CrCode
                      : String(r.CrCode ?? ""),
                  )}__${r.Section ?? ""}`;
                  const classesHeld =
                    summary?.totalHeld ??
                    (monitoredByCourseSection.get(courseSectionKey) ?? 0);
                  const localClassAvg =
                    classAverageByCourseSection.get(courseSectionKey) ?? null;
                  // Student profile often has one enrollment row per course, which can
                  // collapse local class average to student's own percentage. Prefer
                  // monitoring class average in that case so deviation colors are meaningful.
                  const classAvg =
                    localClassAvg != null &&
                    summary != null &&
                    Math.abs(localClassAvg - summary.percentage) < 0.0001
                      ? monitoringClassAverage
                      : (localClassAvg ?? monitoringClassAverage);
                  const level =
                    summary && classAvg != null
                      ? (comparison => {
                          if (comparison >= 40) return "critical" as const;
                          if (comparison >= 20) return "warning" as const;
                          return null;
                        })(classAvg - summary.percentage)
                      : null;

                  return (
                    <tr
                      key={key}
                      className={cn(
                        "border-b border-gray-100 last:border-0 dark:border-gray-800",
                        level === "critical" &&
                          "bg-red-50/60 dark:bg-red-900/10",
                        level === "warning" &&
                          "bg-yellow-50/70 dark:bg-yellow-900/15",
                      )}
                    >
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                        {(r.CrTitle ?? r.CrCode ?? "—") +
                          " - " +
                          (r.CrCode ?? "—")}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        {formatAcademicTermLabel(
                          String((r as { Peryr?: string }).Peryr ?? ""),
                          String((r as { Perid?: string }).Perid ?? "")
                        ) ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        {r.Teacher ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-center",
                          level === "critical" &&
                            "text-red-500 dark:text-red-300 font-semibold",
                          level === "warning" &&
                            "text-yellow-700 dark:text-yellow-300 font-semibold",
                          level == null && "text-black dark:text-emerald-300",
                        )}
                      >
                        {summary
                          ? `${summary.percentage.toFixed(1)}% (${summary.attended}/${summary.attendanceMarked})`
                          : classesHeld
                            ? `0.0% (0/${classesHeld})`
                            : "—"}
                      </td>
                    </tr>
                  );
                })}
                {dbTableRows.map((r) => {
                  const classAvg = r.classAverageAttendance ?? monitoringClassAverage;
                  const level =
                    r.attendanceAlertLevel ??
                    (classAvg != null
                      ? (comparison => {
                          if (comparison >= 40) return "critical" as const;
                          if (comparison >= 20) return "warning" as const;
                          return null;
                        })(classAvg - (r.attendancePercentage ?? 0))
                      : null);
                  return (
                    <tr
                      key={`${r.courseId}__${r.sectionCode ?? ""}`}
                      className={cn(
                        "border-b border-gray-100 last:border-0 dark:border-gray-800",
                        level === "critical" &&
                          "bg-red-50/60 dark:bg-red-900/10",
                        level === "warning" &&
                          "bg-yellow-50/70 dark:bg-yellow-900/15",
                      )}
                    >
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                        {(r.courseTitle ?? r.courseId ?? "—") +
                          " - " +
                          (r.courseId ?? "—")}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        {r.termLabel ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        {r.instructorName ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-center",
                          level === "critical" &&
                            "text-red-500 dark:text-red-300 font-semibold",
                          level === "warning" &&
                            "text-yellow-700 dark:text-yellow-300 font-semibold",
                          level == null && "text-black dark:text-emerald-300",
                        )}
                      >
                        {`${(r.attendancePercentage ?? 0).toFixed(1)}% (${r.classesAttended}/${r.attendanceMarkedClasses})`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

