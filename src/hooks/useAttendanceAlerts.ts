import { useEffect, useMemo, useState } from "react";
import type { EnrollmentRecord } from "@/lib/enrollment";
import {
  getAttendanceSummariesForEnrollments,
  getEnrollmentAttendanceKey,
  type AttendanceSummary,
  normalizeCourseCode,
} from "@/lib/attendance-utils";
import { useMonitoringStudents } from "./useMonitoringStudents";

export type AttendanceAlertsState = {
  attendanceSummaries: Map<string, AttendanceSummary> | null;
  classAverageByCourseSection: Map<string, number>;
  monitoredByCourseSection: Map<string, number>;
  isAttendanceLoading: boolean;
};

/**
 * Shared hook to compute attendance summaries and class averages
 * for a given list of enrollment records.
 *
 * This centralizes the monitoring fetch + summary calculations so
 * multiple components (tables, dean stats) can reuse the same logic.
 */
export function useAttendanceAlerts(
  enrollments: EnrollmentRecord[],
): AttendanceAlertsState {
  const { data: monitoringData } = useMonitoringStudents();
  const [attendanceSummaries, setAttendanceSummaries] = useState<
    Map<string, AttendanceSummary> | null
  >(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  const monitoredByCourseSection = useMemo(() => {
    const map = new Map<string, number>();
    const classes = monitoringData?.classes ?? [];
    for (const c of classes) {
      const key = `${normalizeCourseCode(
        typeof c.CrCode === "string" ? c.CrCode : String(c.CrCode ?? ""),
      )}__${c.SecCode ?? ""}`;
      map.set(key, (map.get(key) ?? 0) + (c.Att ?? 0));
    }
    return map;
  }, [monitoringData]);

  useEffect(() => {
    if (!enrollments.length) {
      setAttendanceSummaries(null);
      return;
    }

    setIsAttendanceLoading(true);
    getAttendanceSummariesForEnrollments(enrollments, monitoredByCourseSection)
      .then((map) => {
        setAttendanceSummaries(map);
      })
      .catch(() => {
        setAttendanceSummaries(null);
      })
      .finally(() => {
        setIsAttendanceLoading(false);
      });
  }, [enrollments, monitoredByCourseSection]);

  const classAverageByCourseSection = useMemo(() => {
    const map = new Map<string, number>();
    const counts = new Map<string, number>();
    if (!attendanceSummaries) return map;

    for (const row of enrollments) {
      const sectionKey = `${normalizeCourseCode(
        typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? ""),
      )}__${row.Section ?? ""}`;
      const attKey = getEnrollmentAttendanceKey(row);
      const summary = attendanceSummaries.get(attKey);
      if (!summary) continue;

      const prevSum = map.get(sectionKey) ?? 0;
      const prevCount = counts.get(sectionKey) ?? 0;
      map.set(sectionKey, prevSum + summary.percentage);
      counts.set(sectionKey, prevCount + 1);
    }

    for (const [key, sum] of map.entries()) {
      const count = counts.get(key) ?? 1;
      map.set(key, sum / count);
    }

    return map;
  }, [attendanceSummaries, enrollments]);

  return {
    attendanceSummaries,
    classAverageByCourseSection,
    monitoredByCourseSection,
    isAttendanceLoading,
  };
}

