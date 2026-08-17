import type { EnrollmentRecord } from "@/lib/enrollment/types";

type RawAttendanceRecord = {
  Sapno: string;
  AcadYear: string;
  ClassType: string;
  StdName: string;
  AcadPerid: string;
  CrCode: string;
  CrTitle: string;
  Section?: string;
  Adate: string;
  Atime: string;
  EventPackageId?: string;
  EventId?: string;
};

export type AttendanceSummary = {
  absences: number;
  /** All sessions held (SAP Held); includes classes not yet marked. */
  totalHeld: number;
  /** Sessions with attendance posted (SAP Att); denominator for attendance %. */
  attendanceMarked: number;
  attended: number;
  percentage: number;
};

export type AttendanceAlertLevel = "warning" | "critical" | null;

let attendanceDataCache: RawAttendanceRecord[] | null = null;
let absenceIndexCache: Map<string, number> | null = null;

export function normalizeCourseCode(raw: string | undefined | null): string {
  if (!raw) return "";
  const [code] = raw.split("|");
  return code.trim();
}

function buildEnrollmentKey(record: {
  SapNo: string;
  CrCode?: string;
  SectionOrPackage?: string;
}): string {
  const course = normalizeCourseCode(record.CrCode ?? "");
  const section = record.SectionOrPackage ?? "";
  return `${record.SapNo}__${course}__${section}`;
}

/** Exported so table components can build stable keys that match this utility. */
export function getEnrollmentAttendanceKey(enrollment: EnrollmentRecord): string {
  const sectionOrPackage =
    // In enrollment_data.json this is the link to EventPackageId / Section in attendance_data.json.
    // Not part of the typed model, so we read it defensively.
    (enrollment as unknown as { Packnumber?: string }).Packnumber ??
    enrollment.Section ??
    "";
  return buildEnrollmentKey({
    SapNo: enrollment.SapNo,
    CrCode: typeof enrollment.CrCode === "string" ? enrollment.CrCode : "",
    SectionOrPackage:
      typeof sectionOrPackage === "string" ? sectionOrPackage : String(sectionOrPackage ?? ""),
  });
}

async function loadAttendanceData(): Promise<RawAttendanceRecord[]> {
  if (attendanceDataCache) return attendanceDataCache;
  const res = await fetch("/attendance_data.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load attendance_data.json (${res.status})`);
  }
  const data = (await res.json()) as unknown;
  const list = Array.isArray(data) ? (data as RawAttendanceRecord[]) : [];
  attendanceDataCache = list;
  return list;
}

function buildAbsenceIndex(records: RawAttendanceRecord[]): Map<string, number> {
  if (absenceIndexCache) return absenceIndexCache;
  const index = new Map<string, number>();

  for (const r of records) {
    const key = buildEnrollmentKey({
      SapNo: r.Sapno,
      CrCode: r.CrCode,
      SectionOrPackage: r.EventPackageId ?? r.Section,
    });
    if (!key) continue;
    index.set(key, (index.get(key) ?? 0) + 1);
  }

  absenceIndexCache = index;
  return index;
}

/**
 * Given enrollment rows and monitoring maps (Held vs Att),
 * returns per-enrollment attendance summaries aligned with student sync:
 * - totalHeld: Held (all sessions run)
 * - attendanceMarked: Att (posted); used as denominator for %
 * - attended: attendanceMarked - absences (absence rows from attendance_data.json)
 * - percentage: attended / attendanceMarked * 100 when posted > 0
 */
export async function getAttendanceSummariesForEnrollments(
  enrollments: EnrollmentRecord[],
  classesHeldByCourseSection: Map<string, number>,
  attendanceMarkedByCourseSection: Map<string, number>,
  classesHeldByCourse?: Map<string, number>,
  attendanceMarkedByCourse?: Map<string, number>
): Promise<Map<string, AttendanceSummary>> {
  const summaries = new Map<string, AttendanceSummary>();
  if (!enrollments.length) return summaries;

  let records: RawAttendanceRecord[];
  try {
    records = await loadAttendanceData();
  } catch {
    return summaries;
  }

  const absenceIndex = buildAbsenceIndex(records);

  for (const e of enrollments) {
    const key = getEnrollmentAttendanceKey(e);
    if (!key) continue;

    const section = e.Section ?? "";
    const courseNorm = normalizeCourseCode(
      typeof e.CrCode === "string" ? e.CrCode : String(e.CrCode ?? "")
    );
    const classType = String(
      (e as unknown as { ClassType?: string }).ClassType ?? ""
    )
      .trim()
      .toLowerCase();
    const teacher = String(e.Teacher ?? "")
      .trim()
      .toLowerCase();
    const lookupKeys = [
      classType && teacher ? `${courseNorm}__${section}__${classType}__${teacher}` : null,
      classType ? `${courseNorm}__${section}__${classType}` : null,
      teacher ? `${courseNorm}__${section}__teacher__${teacher}` : null,
      `${courseNorm}__${section}`,
    ].filter((k): k is string => Boolean(k));
    const totalHeldRaw =
      lookupKeys.map((k) => classesHeldByCourseSection.get(k)).find((v) => v != null) ??
      classesHeldByCourse?.get(courseNorm) ??
      0;
    const totalHeld =
      typeof totalHeldRaw === "number"
        ? totalHeldRaw
        : Number(totalHeldRaw) || 0;

    const markedRaw =
      lookupKeys.map((k) => attendanceMarkedByCourseSection.get(k)).find((v) => v != null) ??
      attendanceMarkedByCourse?.get(courseNorm) ??
      0;
    const attendanceMarked =
      typeof markedRaw === "number" ? markedRaw : Number(markedRaw) || 0;

    const absences = absenceIndex.get(key) ?? 0;
    const attended = attendanceMarked - absences;
    const percentage =
      attendanceMarked > 0 ? (attended / attendanceMarked) * 100 : 0;

    summaries.set(key, {
      absences,
      totalHeld,
      attendanceMarked,
      attended,
      percentage,
    });
  }

  return summaries;
}

/** Minimum posted attendances before a yellow/red alert is trustworthy. */
export const ATTENDANCE_ALERT_MIN_MARKED = 3;
/** Minimum share of held classes that must be posted before alerting. */
export const ATTENDANCE_ALERT_MIN_COVERAGE = 0.75;

export function getAttendanceAlertLevel(
  studentPercentage: number,
  classAverage: number | null | undefined,
  totalClassesHeld?: number | null,
  attendanceMarked?: number | null
): AttendanceAlertLevel {
  const held = Number(totalClassesHeld);
  if (!Number.isFinite(held) || held <= 0) return null;

  const markedRaw = Number(attendanceMarked);
  const marked =
    attendanceMarked == null || !Number.isFinite(markedRaw) ? held : markedRaw;
  if (marked <= 0) return null;
  if (marked < ATTENDANCE_ALERT_MIN_MARKED) return null;
  if (marked / held < ATTENDANCE_ALERT_MIN_COVERAGE) return null;

  if (!Number.isFinite(studentPercentage)) return null;
  if (studentPercentage <= 60) return "critical";
  if (classAverage == null || !Number.isFinite(classAverage)) return null;
  const diff = classAverage - studentPercentage; // positive = below class average
  if (diff >= 20) return "warning";
  return null;
}


