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
  /**
   * GPA alert level per student SAP id (from monitoring students),
   * used by table filters (yellow/red/good).
   */
  gpaAlertLevelBySapId: Map<string, "critical" | "warning" | null>;
  /** Current GPA value per student SAP id (from monitoring students). */
  gpaCurrentBySapId: Map<string, number | null>;
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

  const gpaAlertLevelBySapId = useMemo(() => {
    const map = new Map<string, "critical" | "warning" | null>();
    for (const s of monitoringData?.students ?? []) {
      const sapId = String((s as any).sap_id ?? "").trim();
      if (!sapId) continue;
      // Student.gpa.alert_level is already "critical" | "warning" | null.
      map.set(sapId, (s as any).gpa?.alert_level ?? null);
    }
    return map;
  }, [monitoringData]);

  const gpaCurrentBySapId = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const s of monitoringData?.students ?? []) {
      const sapId = String((s as any).sap_id ?? "").trim();
      if (!sapId) continue;
      const rawCurrent = (s as any).gpa?.current;
      const current =
        typeof rawCurrent === "number"
          ? rawCurrent
          : Number(rawCurrent);
      map.set(sapId, Number.isFinite(current) ? current : null);
    }
    return map;
  }, [monitoringData]);

  const monitoredByCourseSection = useMemo(() => {
    const map = new Map<string, number>();
    const classes = monitoringData?.classes ?? [];
    for (const c of classes) {
      const key = `${normalizeCourseCode(
        typeof c.CrCode === "string" ? c.CrCode : String(c.CrCode ?? ""),
      )}__${c.SecCode ?? ""}`;
      const scheduled =
        typeof c.ToDate === "number"
          ? c.ToDate
          : Number(c.ToDate ?? 0) || 0;
      map.set(key, scheduled);
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
    gpaAlertLevelBySapId,
    gpaCurrentBySapId,
  };
}

