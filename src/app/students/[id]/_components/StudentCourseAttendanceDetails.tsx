"use client";

import { useMemo } from "react";
import type { EnrollmentRecord } from "@/lib/enrollment";
import { cn } from "@/lib/utils";
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
  selectedCourseCode?: string;
  selectedSection?: string;
  overallAttendance: OverallAttendance;
};

export function StudentCourseAttendanceDetails({
  enrollmentRecords,
  selectedCourseCode,
  selectedSection,
  overallAttendance,
}: Props) {
  const {
    attendanceSummaries,
    classAverageByCourseSection,
    monitoredByCourseSection,
  } = useAttendanceAlerts(enrollmentRecords);

  const {
    selectedSummary,
    selectedClassAvg,
    selectedLabel,
  } = useMemo(() => {
    if (!enrollmentRecords.length || !attendanceSummaries) {
      return { selectedSummary: null, selectedClassAvg: null, selectedLabel: null };
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

    if (!target) {
      target = enrollmentRecords[0] ?? null;
    }
    if (!target) {
      return { selectedSummary: null, selectedClassAvg: null, selectedLabel: null };
    }

    const key = getEnrollmentAttendanceKey(target);
    const monitorKey = `${normalizeCourseCode(
      typeof target.CrCode === "string"
        ? target.CrCode
        : String(target.CrCode ?? ""),
    )}__${target.Section ?? ""}`;
    const summary = attendanceSummaries.get(key) ?? null;
    const classAvg =
      classAverageByCourseSection.get(monitorKey ?? "") ?? null;

    const label = `${target.CrTitle ?? target.CrCode ?? "Course"}${
      target.Section ? ` (${target.Section})` : ""
    }`;

    return { selectedSummary: summary, selectedClassAvg: classAvg, selectedLabel: label };
  }, [attendanceSummaries, classAverageByCourseSection, enrollmentRecords, selectedCourseCode, selectedSection]);

  const displayTotalHeld =
    selectedSummary?.totalHeld ?? overallAttendance.total_classes_held;
  const displayAttended =
    selectedSummary?.attended ?? overallAttendance.classes_attended;
  const displayMissed = Math.max(0, displayTotalHeld - displayAttended);
  const displayPercentage =
    selectedSummary?.percentage ?? overallAttendance.attendance_percentage;
  const displayClassAvg =
    selectedClassAvg ?? overallAttendance.class_average_attendance;

  const comparison = displayPercentage - displayClassAvg;
  const isDanger = comparison < -40;
  const isWarning = !isDanger && comparison < -20;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        {selectedLabel && (
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Course focus:{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {selectedLabel}
            </span>
          </p>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Attendance for this course
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
              {Number.isFinite(displayClassAvg) && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    comparison >= 0 ? "text-emerald-600" : "text-red-500",
                  )}
                >
                  ({comparison >= 0 ? "+" : ""}
                  {comparison.toFixed(1)}% vs class avg)
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

      <div className="grid grid-cols-3 gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
        <div className="text-center">
          <p className="text-2xl font-bold dark:text-green-500">
            {displayTotalHeld}
          </p>
          <p className="text-xs dark:text-green-500">Classes Held</p>
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

      {enrollmentRecords.length > 0 && (
        <div className="mt-2 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Attendance details (courses)
          </h4>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white/50 dark:border-gray-700 dark:bg-gray-900/20">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800">
                  <th className="px-4 py-2 font-semibold">Course - Code</th>
                  <th className="px-4 py-2 font-semibold">Instructor</th>
                  <th className="px-4 py-2 font-semibold text-center">
                    Attendance
                  </th>
                </tr>
              </thead>
              <tbody>
                {enrollmentRecords.map((r) => {
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

                  return (
                    <tr
                      key={key}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                    >
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                        {(r.CrTitle ?? r.CrCode ?? "—") +
                          " - " +
                          (r.CrCode ?? "—")}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        {r.Teacher ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-700 dark:text-gray-300">
                        {summary
                          ? `${summary.percentage.toFixed(1)}% (${summary.attended}/${summary.totalHeld})`
                          : classesHeld
                            ? `0.0% (0/${classesHeld})`
                            : "—"}
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

