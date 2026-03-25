"use client";

import type { DeanStatsUser, EnrollmentRecord } from "@/lib/enrollment";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { useAttendanceAlerts } from "@/hooks/useAttendanceAlerts";
import {
  getAttendanceAlertLevel,
  getEnrollmentAttendanceKey,
  normalizeCourseCode,
} from "@/lib/attendance-utils";

type PropsType = {
  user: DeanStatsUser | null;
  selectedCourseId?: string;
  /** When set, these courses are shown as selected (bordered) from MasterFilter. */
  masterFilterCourseIds?: string[];
  /** Filtered enrollment data used for grouping. */
  enrollmentData?: EnrollmentRecord[] | null;
  /** Optional callback to update filters client-side instead of navigating. */
  onSelectCourseId?: (courseId: string) => void;
};

function getRowGpaAlertLevel(
  row: EnrollmentRecord
): "warning" | "critical" | null {
  const anyRow = row as Record<string, unknown>;

  const directCandidates = [
    anyRow.gpa_alert_level,
    anyRow.GPAAlertLevel,
    anyRow.gpaAlertLevel,
    anyRow.gpa_alert,
    anyRow.GPAAlert,
    anyRow.gpaAlert,
  ];
  for (const value of directCandidates) {
    if (value === "critical" || value === "red") return "critical";
    if (value === "warning" || value === "yellow") return "warning";
  }

  const numericCandidates = [
    anyRow.gpa_change,
    anyRow.GPAChange,
    anyRow.gpaDrop,
    anyRow.GPADrop,
  ];
  for (const value of numericCandidates) {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string"
        ? Number(value)
        : NaN;
    if (!Number.isFinite(n)) continue;
    const drop = Math.abs(Math.min(0, n));
    if (drop >= 1) return "critical";
    if (drop >= 0.5) return "warning";
  }

  return null;
}

export function DeanCourseStats({
  user,
  selectedCourseId,
  masterFilterCourseIds,
  enrollmentData = [],
  onSelectCourseId,
}: PropsType) {
  if (!user || user.role !== "dean") return null;

  const rows = enrollmentData ?? [];
  if (!rows.length) return null;

  const byCourse = new Map<
    string,
    {
      code: string;
      title: string;
      total: number;
      yellowAttendance: number;
      redAttendance: number;
      yellowGpa: number;
      redGpa: number;
    }
  >();
  const { attendanceSummaries, classAverageByCourseSection } =
    useAttendanceAlerts(rows);

  const attendanceAlertByRowKey = useMemo(() => {
    const map = new Map<string, "warning" | "critical" | null>();
    if (!attendanceSummaries) return map;
    for (const row of rows) {
      const attendanceKey = getEnrollmentAttendanceKey(row);
      const summary = attendanceSummaries.get(attendanceKey);
      const monitorKey = `${normalizeCourseCode(
        typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? ""),
      )}__${row.Section ?? ""}`;
      const classAvg = classAverageByCourseSection.get(monitorKey ?? "") ?? null;
      const level =
        summary && classAvg != null
          ? getAttendanceAlertLevel(summary.percentage, classAvg)
          : null;
      map.set(attendanceKey, level);
    }
    return map;
  }, [rows, attendanceSummaries, classAverageByCourseSection]);

  for (const r of rows) {
    const rawCode = (r.CrCode ?? "").toString().trim();
    const rawTitle = (r.CrTitle ?? "").toString().trim();
    const key = rawCode || rawTitle;
    if (!key) continue;
    if (!byCourse.has(key)) {
      byCourse.set(key, {
        code: rawCode || "—",
        title: rawTitle || rawCode || key,
        total: 0,
        yellowAttendance: 0,
        redAttendance: 0,
        yellowGpa: 0,
        redGpa: 0,
      });
    }
    const bucket = byCourse.get(key)!;
    bucket.total += 1;
    const level = attendanceAlertByRowKey.get(getEnrollmentAttendanceKey(r));
    if (level === "warning") bucket.yellowAttendance += 1;
    if (level === "critical") bucket.redAttendance += 1;
    const gpaLevel = getRowGpaAlertLevel(r);
    if (gpaLevel === "warning") bucket.yellowGpa += 1;
    if (gpaLevel === "critical") bucket.redGpa += 1;
  }

  const list = Array.from(byCourse.values()).sort((a, b) =>
    (a.code || a.title).localeCompare(b.code || b.title),
  );

  if (!list.length) return null;

  return (
    <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
      {list.map((c) => {
        const key = c.code || c.title;
        const isSelected = masterFilterCourseIds?.length
          ? masterFilterCourseIds.includes(key)
          : selectedCourseId === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectCourseId?.(key)}
            className={cn(
              "inline-flex bg-white flex-col rounded-lg border px-4 py-3 shadow-1 dark:bg-gray-dark transition hover:border-primary/50 hover:shadow dark:border-stroke-dark dark:hover:border-primary/50",
              "min-w-[160px]",
              isSelected
                ? "border-2 border-primary dark:border-primary"
                : "border-stroke",
            )}
          >
            <span className="text-body-sm font-semibold text-dark dark:text-white">
              {c.title}{" "}
              <span className="text-body-base dark:text-dark-5">
                ({c.total})
              </span>
            </span>
            <span className="text-body-base text-dark-6 space-x-2 dark:text-dark-5">
              Att:{" "}
              <span
                className={cn(
                  "text-amber-500 dark:text-amber-500 font-bold",
                  c.yellowAttendance > 0
                    ? "text-amber-500 dark:text-amber-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {c.yellowAttendance}
              </span>
              {" | "}
              <span
                className={cn(
                  "text-red-500 font-bold",
                  c.redAttendance > 0
                    ? "text-red-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {c.redAttendance}
              </span>
              {" · "}
              GPA:{" "}
              <span
                className={cn(
                  "text-amber-500 dark:text-amber-500 font-bold",
                  c.yellowGpa > 0
                    ? "text-amber-500 dark:text-amber-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {c.yellowGpa}
              </span>
              {" | "}
              <span
                className={cn(
                  "text-red-500 font-bold",
                  c.redGpa > 0
                    ? "text-red-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {c.redGpa}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

