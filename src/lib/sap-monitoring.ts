import { XMLParser } from "fast-xml-parser";
import type { Student, GpaHistoryEntry } from "@/app/(home)/dashboard/fetch";
import { THRESHOLDS } from "@/app/(home)/dashboard/fetch";

export type MonitoringParams = {
  Campus: string;
  PYear: string;
  PSess: string;
  Begda: string;
  Endda: string;
  /** Optional: filter to one student by SAP ID (EObjid). */
  EObjid?: string;
};

type MonitoringProperties = {
  Begda?: string;
  Campus?: string;
  PYear?: string;
  Endda?: string;
  Factulty?: string;
  PSess?: string;
  Department?: string;
  Degree?: string;
  CrTitle?: string;
  CrCode?: string;
  SecCode?: string;
  ClassType?: string;
  ClassDay?: string;
  TeacherName?: string;
  Sdate?: string;
  Edate?: string;
  ToDate?: string | number;
  Monitored?: string | number;
  Held?: string | number;
  NotHeld?: string | number;
  NotMonitored?: string | number;
  Att?: string | number;
  AttDiff?: string | number;
  AttEnter?: string | number;
  MakeupHeld?: string | number;
  CrHr?: string | number;
  MonitoredDt?: string;
  EObjid?: string;
};

export type MonitoringEntry = MonitoringProperties;

function getSapCredentials() {
  const username = process.env.SAP_USERNAME;
  const password = process.env.SAP_PASSWORD;
  if (!username || !password) {
    throw new Error("SAP_USERNAME and SAP_PASSWORD must be set in environment");
  }
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

function buildFilter(params: MonitoringParams): string {
  const { Campus, PYear, PSess, Begda, Endda, EObjid } = params;
  let filter = `(Campus eq '${Campus}' and PYear eq '${PYear}' and PSess eq '${PSess}' and Begda eq '${Begda}' and Endda eq '${Endda}'`;
  if (EObjid != null && EObjid !== "") {
    filter += ` and EObjid eq '${EObjid}'`;
  }
  filter += ")";
  return filter;
}

export async function fetchMonitoringEntries(
  params: MonitoringParams
): Promise<MonitoringEntry[]> {
  const baseUrl =
    "https://hub.uol.edu.pk/sap/opu/odata/sap/ZCLASS_MONITORING_SRV/monitoringSet";
  const filter = buildFilter(params);
  // SAP endpoint expects only spaces and quotes encoded, parentheses left as-is.
  const encodedFilter = filter.replace(/ /g, "%20").replace(/'/g, "%27");
  const url = `${baseUrl}?$filter=${encodedFilter}`;

  const authHeader = getSapCredentials();

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/xml",
      Authorization: authHeader,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`SAP monitoring API error: ${res.status} ${res.statusText}`);
    return [];
  }

  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
    /** SAP OData feed has many entries; default 100 is too low. */
    maxNestedTags: 500000,
  });
  const json = parser.parse(xml);

  const feed = json.feed ?? json;
  if (!feed) return [];

  const rawEntries = Array.isArray(feed.entry)
    ? feed.entry
    : feed.entry
    ? [feed.entry]
    : [];

  const entries: MonitoringEntry[] = [];

  for (const entry of rawEntries) {
    const props: MonitoringProperties | undefined =
      entry?.content?.properties ?? entry?.content?.["m:properties"];
    if (!props) continue;
    entries.push(props);
  }

  return entries;
}

type MonitoringCacheEntry = {
  key: string;
  entries: MonitoringEntry[];
  fetchedAt: number;
};

let monitoringCache: MonitoringCacheEntry | null = null;
const MONITORING_CACHE_TTL_MS =
  Number(process.env.SAP_MONITORING_CACHE_TTL ?? "60000");

export async function getCachedMonitoringEntries(
  params: MonitoringParams
): Promise<MonitoringEntry[]> {
  const key = JSON.stringify(params);
  const now = Date.now();
  if (
    monitoringCache &&
    monitoringCache.key === key &&
    now - monitoringCache.fetchedAt < MONITORING_CACHE_TTL_MS
  ) {
    return monitoringCache.entries;
  }
  const entries = await fetchMonitoringEntries(params);
  monitoringCache = { key, entries, fetchedAt: now };
  return entries;
}

function toNumber(value: string | number | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Attendance alert level based on deviation from class average.
 * - 20–39 percentage points below class average → "warning"
 * - ≥ 40 percentage points below class average → "critical"
 */
function deriveAttendanceAlertLevel(
  percentage: number,
  classAverage: number | null | undefined
): "critical" | "warning" | null {
  if (classAverage == null) return null;
  const diff = classAverage - percentage; // positive = student is below class average
  if (diff >= 40) return "critical";
  if (diff >= 20) return "warning";
  return null;
}

/** Map SAP monitoring rows into Student objects (GPA fields are stubbed for now). */
export function mapMonitoringToStudents(entries: MonitoringEntry[]): Student[] {
  if (!entries.length) return [];

  // Group by student + course/section so we treat each row as one course enrollment.
  const students: Student[] = [];

  // First, group entries by a "class" key to compute class averages.
  type ClassKey = string;
  const classGroups = new Map<ClassKey, MonitoringEntry[]>();

  const getClassKey = (e: MonitoringEntry): ClassKey =>
    [
      e.Campus ?? "",
      e.Department ?? "",
      e.Degree ?? "",
      e.CrCode ?? "",
      e.SecCode ?? "",
      e.TeacherName ?? "",
    ].join("|");

  for (const e of entries) {
    const key = getClassKey(e);
    if (!classGroups.has(key)) classGroups.set(key, []);
    classGroups.get(key)!.push(e);
  }

  const classStats = new Map<
    ClassKey,
    { averageAttendance: number; totalStudents: number }
  >();

  for (const [key, group] of classGroups.entries()) {
    const totalStudents = group.length;
    const sumPct = group.reduce((sum, e) => sum + toNumber(e.AttEnter), 0);
    const averageAttendance = totalStudents ? sumPct / totalStudents : 0;
    classStats.set(key, { averageAttendance, totalStudents });
  }

  for (const e of entries) {
    const sapId = e.EObjid ?? "";
    const courseCode = (e.CrCode ?? "").toString();
    const courseId = courseCode || "UNKNOWN";
    const key = getClassKey(e);
    const stats = classStats.get(key);

    const held = toNumber(e.Held);
    const missed = toNumber(e.AttDiff);
    const attended = toNumber(e.Att) || held - missed;
    const pct = toNumber(e.AttEnter);

    const averageAttendance = stats?.averageAttendance ?? pct;
    const deviation = pct - averageAttendance;
    const totalStudentsInClass = stats?.totalStudents ?? 0;
    const attLevel = deriveAttendanceAlertLevel(pct, averageAttendance);

    const emptyHistory: GpaHistoryEntry[] = [];

    students.push({
      sap_id: sapId,
      name: sapId, // TODO: replace with real student name when available
      course_id: courseId,
      department_id: e.Department ?? "UNKNOWN_DEPT",
      faculty_id: e.Factulty ?? "UNKNOWN_FACULTY",
      department_name: e.Department,
      course_name: e.CrTitle,
      instructor_name: e.TeacherName,
      attendance: {
        total_classes_held: held,
        classes_attended: attended,
        attendance_percentage: pct,
        class_average_attendance: averageAttendance,
        deviation_from_class_avg: deviation,
        total_students_in_class: totalStudentsInClass,
        alert_level: attLevel,
      },
      gpa: {
        history: emptyHistory,
        current: 0,
        previous: 0,
        change: 0,
        trend: "stable",
        class_average_gpa_current: 0,
        class_average_gpa_previous: 0,
        total_students_in_class: totalStudentsInClass,
        alert_level: null,
      },
      overall_alert: attLevel === "critical" || attLevel === "warning" ? attLevel : "none",
    });
  }

  return students;
}

const defaultMonitoringParams = (): MonitoringParams => ({
  Campus: process.env.SAP_CAMPUS ?? "11",
  PYear: process.env.SAP_PYEAR ?? "2026",
  PSess: process.env.SAP_PSESS ?? "001",
  Begda: process.env.SAP_BEGDA ?? "20260120",
  Endda: process.env.SAP_ENDDA ?? "20260520",
});

/**
 * Fetch SAP monitoring data for one student by SAP ID (EObjid).
 * Tries OData $filter with EObjid first; if empty, fetches full set and filters in memory.
 * Returns one Student per course/section for that student; use first for single-course view.
 */
export async function getMonitoringStudentsBySapId(
  sapId: string,
  params?: Partial<MonitoringParams>
): Promise<Student[]> {
  const baseParams = { ...defaultMonitoringParams(), ...params };
  let entries: MonitoringEntry[];

  try {
    entries = await fetchMonitoringEntries({ ...baseParams, EObjid: sapId });
    if (entries.length === 0) {
      const allEntries = await fetchMonitoringEntries(baseParams);
      entries = allEntries.filter((e) => String(e.EObjid ?? "") === String(sapId));
    }
  } catch {
    const allEntries = await fetchMonitoringEntries(baseParams);
    entries = allEntries.filter((e) => String(e.EObjid ?? "") === String(sapId));
  }

  return mapMonitoringToStudents(entries);
}

