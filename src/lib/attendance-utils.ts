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
  totalHeld: number;
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
 * Given enrollment rows and classes-held data (from SAP monitoring),
 * returns per-enrollment attendance summaries:
 * - absences: total absent records in attendance_data.json
 * - totalHeld: total classes held for that course/section
 * - attended: totalHeld - absences (never below 0)
 * - percentage: attended / totalHeld * 100
 */
export async function getAttendanceSummariesForEnrollments(
  enrollments: EnrollmentRecord[],
  classesHeldByCourseSection: Map<string, number>
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

    // For "classes held" we match monitoring SecCode, which aligns with enrollment.Section
    const section = e.Section ?? "";
    const courseSectionKey = `${normalizeCourseCode(
      typeof e.CrCode === "string" ? e.CrCode : String(e.CrCode ?? "")
    )}__${section}`;
    const totalHeldRaw = classesHeldByCourseSection.get(courseSectionKey) ?? 0;
    const totalHeld =
      typeof totalHeldRaw === "number"
        ? totalHeldRaw
        : Number(totalHeldRaw) || 0;

    const absences = absenceIndex.get(key) ?? 0;
    const attended = Math.max(0, totalHeld - absences);
    const percentage =
      totalHeld > 0 ? (attended / totalHeld) * 100 : 0;

    summaries.set(key, {
      absences,
      totalHeld,
      attended,
      percentage,
    });
  }

  return summaries;
}

/**
 * Compare a student's attendance to the class average.
 * - diff 20–39 percentage points below class average → "warning" (yellow)
 * - diff ≥ 40 percentage points below class average → "critical" (red)
 */
export function getAttendanceAlertLevel(
  studentPercentage: number,
  classAverage: number | null | undefined
): AttendanceAlertLevel {
  if (classAverage == null || !Number.isFinite(studentPercentage)) return null;
  const diff = classAverage - studentPercentage; // positive = below class average
  if (diff >= 40) return "critical";
  if (diff >= 20) return "warning";
  return null;
}


