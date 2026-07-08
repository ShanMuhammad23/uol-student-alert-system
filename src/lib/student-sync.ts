import { readFile } from "fs/promises";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { pool } from "@/lib/db";
import { upsertStudentAlertDailySnapshot } from "@/lib/alert-daily-snapshot";
import { fetchMonitoringEntries } from "@/lib/sap-monitoring";
import { getGpaTrendMapBySapIds } from "@/lib/db/gpa";
import { getAttendanceAlertLevel } from "@/lib/attendance-utils";

type EnrollmentRow = {
  SapNo?: string;
  Name?: string;
  FacId?: string;
  DeptId?: string;
  DeptCode?: string;
  DeptName?: string;
  DegreeCode?: string;
  DegreeTitle?: string;
  CrCode?: string;
  CrTitle?: string;
  Section?: string;
  Teacher?: string;
  Pernr?: string;
  Email?: string;
  CampCode?: string;
  Peryr?: string;
  Perid?: string;
  AdmAyear?: string;
  AdmPerid?: string;
  Packnumber?: string;
  CrCreditHrs?: string | number;
  ClassType?: string;
  BookDate?: string;
};

type AttendanceRow = {
  Sapno?: string;
  CrCode?: string;
  EventPackageId?: string;
  /** Same SAP object id as monitoring `EObjid` for this scheduled class. */
  EventId?: string;
  Section?: string;
  Adate?: string;
  ClassType?: string;
};

type AttendanceApiEntry = {
  Sapno?: string;
  CrCode?: string;
  EventPackageId?: string;
  /** Same SAP object id as monitoring `EObjid` for this scheduled class. */
  EventId?: string;
  Section?: string;
  Adate?: string;
  ClassType?: string;
  AcadYear?: string;
  AcadPerid?: string;
};

type StudentSyncOptions = {
  enrollmentFacultyCodes?: string[];
  facultyIds?: string[];
};

type StudentSyncResult = {
  snapshotDate: string;
  sourceEnrollmentRows: number;
  sourceAttendanceRows: number;
  sourceMonitoringRows: number;
  upsertedStudents: number;
  upsertedEnrollments: number;
  upsertedAlerts: number;
  upsertedDailySnapshots: number;
};

const SGPA_WARNING_DROP = 1.0;
const SGPA_CRITICAL_DROP = 1.5;

function normalizeCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return String(asNumber);
  return trimmed;
}

function normalizeCourseCode(raw: string): string {
  const [code] = raw.split("|");
  return code.trim();
}

function normalizeCreditHours(value: string | number | null | undefined): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) return String(asNumber);
  return raw;
}

function parseDateOnly(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const sapDateMatch = raw.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
  if (sapDateMatch) {
    const epoch = Number(sapDateMatch[1]);
    if (Number.isFinite(epoch)) return new Date(epoch).toISOString().slice(0, 10);
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

function mapAdmissionSessionFromPerid(
  perid: string | null | undefined
): "spring" | "summer" | "fall" | null {
  const raw = String(perid ?? "").trim();
  if (!raw) return null;
  const normalized = raw.padStart(3, "0");
  if (normalized === "001") return "spring";
  if (normalized === "002") return "summer";
  if (normalized === "003") return "fall";
  return null;
}

function normalizeLooseText(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** SAP monitoring uniqueness: normalized course + section + CrHr (credit hours). */
function buildCourseSectionCreditKey(
  courseNorm: string,
  sectionCode: string,
  creditHoursKey: string
): string {
  return [courseNorm, sectionCode, creditHoursKey || "na"].join("__");
}

function buildAttendanceAbsenceKey(
  sapId: string,
  courseCode: string,
  packageId: string,
  classTypeKey: string
): string {
  return [sapId, courseCode, packageId, classTypeKey || "na"].join("__");
}

function chunkArray<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function readJsonArray<T>(fileName: string): Promise<T[]> {
  const dataPath = path.join(process.cwd(), "public", fileName);
  const raw = await readFile(dataPath, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function getSapCredentials() {
  const username = process.env.SAP_USERNAME;
  const password = process.env.SAP_PASSWORD;
  if (!username || !password) {
    throw new Error("SAP_USERNAME and SAP_PASSWORD must be set in environment");
  }
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function fetchAttendanceEntriesFromSap(
  acadYear: string,
  acadPerid: string,
  facultyCode: string
): Promise<AttendanceApiEntry[]> {
  const baseUrl =
    process.env.SAP_ATTENDANCE_BASE_URL ??
    "http://uolerp.uol.edu.pk:8000/sap/opu/odata/sap/ZATTENDANCEAPI_SRV/attendanceSet";
  const filter = `(AcadYear eq '${acadYear}' and AcadPerid eq '${acadPerid}' and FacCode eq '${facultyCode}')`;
  const url = new URL(baseUrl);
  url.searchParams.set("$filter", filter);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/xml",
      Authorization: getSapCredentials(),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Attendance API error: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
    maxNestedTags: 800000,
  });
  const json = parser.parse(xml);
  const feed = json.feed ?? json;
  if (!feed) return [];
  const rawEntries = Array.isArray(feed.entry)
    ? feed.entry
    : feed.entry
      ? [feed.entry]
      : [];
  const entries: AttendanceApiEntry[] = [];
  for (const entry of rawEntries) {
    const props: AttendanceApiEntry | undefined =
      entry?.content?.properties ?? entry?.content?.["m:properties"];
    if (!props) continue;
    entries.push(props);
  }
  return entries;
}

function parseFacultyCodeList(raw: string | undefined): string[] {
  return String(raw ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function fetchEnrollmentEntriesFromSap(
  campus: string,
  acadYear: string,
  acadPerid: string,
  facultyCode: string,
  top = 250000
): Promise<EnrollmentRow[]> {
  const baseUrl =
    process.env.SAP_ENROLLMENT_BASE_URL ??
    "https://hub.uol.edu.pk/sap/opu/odata/sap/ZSLCM_ENROLLMENT_SRV/zenrollmentSet";
  const safeTop = Number.isFinite(top) && top > 0 ? Math.trunc(top) : 250000;
  let skip = 0;
  const out: EnrollmentRow[] = [];
  const filter = `(CampCode eq '${campus}' and Peryr eq '${acadYear}' and Perid eq '${acadPerid}' and FacCode eq '${facultyCode}')`;
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
    maxNestedTags: 800000,
  });

  while (true) {
    const url = new URL(baseUrl);
    url.searchParams.set("$filter", filter);
    url.searchParams.set("$top", String(safeTop));
    url.searchParams.set("$skip", String(skip));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/xml",
        Authorization: getSapCredentials(),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(
        `Enrollment API error (faculty=${facultyCode}, skip=${skip}): ${res.status} ${res.statusText}`
      );
    }

    const xml = await res.text();
    const json = parser.parse(xml);
    const feed = json.feed ?? json;
    const rawEntries = Array.isArray(feed?.entry)
      ? feed.entry
      : feed?.entry
        ? [feed.entry]
        : [];
    if (!rawEntries.length) break;

    for (const entry of rawEntries) {
      const props: EnrollmentRow | undefined =
        entry?.content?.properties ?? entry?.content?.["m:properties"];
      if (!props) continue;
      out.push(props);
    }

    if (rawEntries.length < safeTop) break;
    skip += safeTop;
  }

  return out;
}

function buildMultiInsertPlaceholders(
  rowCount: number,
  colCount: number,
  offset = 0
): string {
  const rows: string[] = [];
  for (let r = 0; r < rowCount; r++) {
    const cols: string[] = [];
    for (let c = 0; c < colCount; c++) {
      cols.push(`$${offset + r * colCount + c + 1}`);
    }
    rows.push(`(${cols.join(",")})`);
  }
  return rows.join(",");
}

export async function runStudentSync(
  snapshotDate?: string,
  options?: StudentSyncOptions
): Promise<StudentSyncResult> {
  if (!pool) throw new Error("DATABASE_URL is not configured");

  const date = snapshotDate ?? new Date().toISOString().slice(0, 10);
  const campus = (process.env.SAP_CAMPUS ?? "11").trim();
  const pYear = (process.env.SAP_PYEAR ?? "2026").trim();
  const pSess = (process.env.SAP_PSESS ?? "002").trim();
  const requestedFacultyCodes = (options?.enrollmentFacultyCodes ?? [])
    .map((v) => String(v).trim())
    .filter(Boolean);
  const envFacultyCodes = parseFacultyCodeList(
    process.env.SAP_ENROLLMENT_FAC_CODES ?? "1117,1113"
  );
  const facultyCodes = Array.from(
    new Set(requestedFacultyCodes.length ? requestedFacultyCodes : envFacultyCodes)
  );
  if (!facultyCodes.length) {
    throw new Error(
      "No enrollment faculty code provided. Set SAP_ENROLLMENT_FAC_CODES or pass enrollmentFacultyCodes."
    );
  }
  console.info(
    `[student-sync] Enrollment fetch start campus=${campus} year=${pYear} session=${pSess} faculties=${facultyCodes.join(",")}`
  );

  const enrollmentFetchTop = Number(process.env.SAP_ENROLLMENT_TOP ?? "250000");
  const enrollmentRowsByFaculty = await Promise.all(
    facultyCodes.map(async (facultyCode) => {
      const rows = await fetchEnrollmentEntriesFromSap(
        campus,
        pYear,
        pSess,
        facultyCode,
        enrollmentFetchTop
      );
      console.info(
        `[student-sync] Enrollment fetched facultyCode=${facultyCode} rows=${rows.length}`
      );
      return rows;
    })
  );
  const enrollmentRows = enrollmentRowsByFaculty.flat();
  let attendanceRows: AttendanceRow[] = [];
  try {
    const attendanceRowsByFaculty = await Promise.all(
      facultyCodes.map(async (facultyCode) => {
        const rows = await fetchAttendanceEntriesFromSap(pYear, pSess, facultyCode);
        console.info(
          `[student-sync] Attendance fetched facultyCode=${facultyCode} rows=${rows.length}`
        );
        return rows;
      })
    );
    attendanceRows = attendanceRowsByFaculty.flat();
  } catch {
    attendanceRows = await readJsonArray<AttendanceRow>("attendance_data.json");
  }
  const monitoringEntries = await fetchMonitoringEntries({
    Campus: campus,
    PYear: pYear,
    PSess: pSess,
    Begda: process.env.SAP_BEGDA ?? "20260120",
    Endda: process.env.SAP_ENDDA ?? "20260520",
  });

  const filteredEnrollments = enrollmentRows.filter((row) => {
    const rowCampus = String(row.CampCode ?? "").trim();
    const rowYear = String(row.Peryr ?? "").trim();
    const rowSess = String(row.Perid ?? "").trim();
    if (rowCampus && normalizeCode(rowCampus) !== normalizeCode(campus)) return false;
    if (rowYear && normalizeCode(rowYear) !== normalizeCode(pYear)) return false;
    if (rowSess && normalizeCode(rowSess) !== normalizeCode(pSess)) return false;
    return true;
  });
  const sourceEnrollments = filteredEnrollments.length ? filteredEnrollments : enrollmentRows;
  const validCourses = new Set(
    sourceEnrollments
      .map((r) => normalizeCourseCode(String(r.CrCode ?? "")))
      .filter(Boolean)
  );
  attendanceRows = attendanceRows.filter((row) =>
    validCourses.has(normalizeCourseCode(String(row.CrCode ?? "")))
  );

  type MonitoringHeldPosted = { held: number; marked: number };
  const monitoringByCourseSectionCredit = new Map<string, MonitoringHeldPosted>();
  for (const entry of monitoringEntries) {
    const course = normalizeCourseCode(String(entry.CrCode ?? ""));
    const section = String(entry.SecCode ?? "").trim();
    const creditHoursKey = normalizeCreditHours(entry.CrHr) || "na";
    if (!course || !section) continue;
    const heldRaw = entry.Held ?? entry.ToDate;
    const held =
      typeof heldRaw === "number" ? heldRaw : Number(heldRaw ?? 0) || 0;
    const markedRaw = entry.Att;
    const marked =
      typeof markedRaw === "number" ? markedRaw : Number(markedRaw ?? 0) || 0;
    const k = buildCourseSectionCreditKey(course, section, creditHoursKey);
    monitoringByCourseSectionCredit.set(k, { held, marked });
    // SAP aligns monitoring `EObjid` with attendance `EventId` for the same scheduled class (not SapNo).
  }

  const absencesByEnrollmentClassKey = new Map<string, number>();
  /** Same absence rows, keyed only by sap + course + event package (ClassType often missing on enrollment). */
  const absencesByCoursePackage = new Map<string, number>();
  const bookDateByEnrollmentKey = new Map<string, string>();
  for (const row of sourceEnrollments) {
    const sapId = String(row.SapNo ?? "").trim();
    const course = normalizeCourseCode(String(row.CrCode ?? ""));
    const pkg = String(row.Packnumber ?? row.Section ?? "").trim();
    const bookDate = parseDateOnly(row.BookDate);
    if (!sapId || !course || !pkg || !bookDate) continue;
    const key = `${sapId}__${course}__${pkg}`;
    const existing = bookDateByEnrollmentKey.get(key);
    if (!existing || bookDate > existing) {
      bookDateByEnrollmentKey.set(key, bookDate);
    }
  }
  for (const row of attendanceRows) {
    const sapId = String(row.Sapno ?? "").trim();
    const course = normalizeCourseCode(String(row.CrCode ?? ""));
    const pkg = String(row.EventPackageId ?? row.Section ?? "").trim();
    const classTypeKey = normalizeLooseText(String(row.ClassType ?? "")) || "na";
    if (!sapId || !course || !pkg) continue;
    const bookDateKey = `${sapId}__${course}__${pkg}`;
    const key = buildAttendanceAbsenceKey(sapId, course, pkg, classTypeKey);
    const attendanceDate = parseDateOnly(row.Adate);
    const bookDate = bookDateByEnrollmentKey.get(bookDateKey);
    if (bookDate) {
      if (!attendanceDate || attendanceDate <= bookDate) continue;
    }
    absencesByEnrollmentClassKey.set(
      key,
      (absencesByEnrollmentClassKey.get(key) ?? 0) + 1
    );
    const packageKey = `${sapId}__${course}__${pkg}`;
    absencesByCoursePackage.set(
      packageKey,
      (absencesByCoursePackage.get(packageKey) ?? 0) + 1
    );
  }

  const attendancePctByEnrollmentKey = new Map<string, number | null>();
  const classSumByCourseSectionCredit = new Map<string, number>();
  const classCountByCourseSectionCredit = new Map<string, number>();

  type EnrollmentPrepared = {
    sapId: string;
    studentName: string;
    facultyId: string;
    departmentId: string;
    departmentCode: string;
    departmentName: string;
    programId: string | null;
    programTitle: string | null;
    courseId: string;
    courseTitle: string;
    sectionCode: string;
    eventPackageId: string;
    instructorPernr: string | null;
    instructorName: string | null;
    instructorEmail: string | null;
    termYear: string;
    termSession: string;
    admissionYear: string | null;
    admissionPeriodId: string | null;
    admissionSession: "spring" | "summer" | "fall" | null;
    campusCode: string;
    classTypeKey: string;
    creditHoursKey: string;
    degreeKey: string;
    originalEventPackageId: string;
  };

  const prepared: EnrollmentPrepared[] = [];
  const seenEnrollmentKeys = new Set<string>();
  for (const row of sourceEnrollments) {
    const sapId = String(row.SapNo ?? "").trim();
    const courseRaw = String(row.CrCode ?? "").trim();
    const courseNorm = normalizeCourseCode(courseRaw);
    const sectionCode = String(row.Section ?? "").trim();
    const originalEventPackageId = String(row.Packnumber ?? row.Section ?? "").trim();
    const facultyId = String(row.FacId ?? "").trim();
    const departmentId = String(row.DeptId ?? row.DeptCode ?? "").trim();
    const departmentCode = String(row.DeptCode ?? row.DeptId ?? "").trim();
    const classTypeKey = String(row.ClassType ?? "").trim().toLowerCase();
    const degreeKey = normalizeCode(String(row.DegreeCode ?? "").trim());
    if (!sapId || !courseRaw || !courseNorm || !sectionCode || !originalEventPackageId || !facultyId || !departmentId) {
      continue;
    }
    const enrollmentCreditKey = normalizeCreditHours(row.CrCreditHrs) || "na";
    const monitoringRowKey = buildCourseSectionCreditKey(
      courseNorm,
      sectionCode,
      enrollmentCreditKey
    );
    const pair =
      monitoringByCourseSectionCredit.get(monitoringRowKey) ?? { held: 0, marked: 0 };
    const eventPackageId = `${originalEventPackageId}__${enrollmentCreditKey}`;
    const dedupeKey = `${sapId}__${courseRaw}__${sectionCode}__${eventPackageId}`;
    if (seenEnrollmentKeys.has(dedupeKey)) continue;
    seenEnrollmentKeys.add(dedupeKey);

    prepared.push({
      sapId,
      studentName: String(row.Name ?? "").trim() || sapId,
      facultyId,
      departmentId,
      departmentCode,
      departmentName: String(row.DeptName ?? "").trim() || departmentId,
      programId: String(row.DegreeCode ?? "").trim() || null,
      programTitle: String(row.DegreeTitle ?? "").trim() || null,
      courseId: courseRaw,
      courseTitle: String(row.CrTitle ?? "").trim() || courseRaw,
      sectionCode,
      eventPackageId,
      originalEventPackageId,
      instructorPernr: String(row.Pernr ?? "").trim() || null,
      instructorName: String(row.Teacher ?? "").trim() || null,
      instructorEmail: String(row.Email ?? "").trim() || null,
      termYear: String(row.Peryr ?? pYear).trim(),
      termSession: String(row.Perid ?? pSess).trim(),
      admissionYear: String(row.AdmAyear ?? "").trim() || null,
      admissionPeriodId: String(row.AdmPerid ?? "").trim() || null,
      admissionSession: mapAdmissionSessionFromPerid(row.AdmPerid),
      campusCode: String(row.CampCode ?? campus).trim(),
      classTypeKey,
      creditHoursKey: enrollmentCreditKey,
      degreeKey,
    });

    const enrollClassKey = buildAttendanceAbsenceKey(
      sapId,
      courseNorm,
      originalEventPackageId,
      enrollmentCreditKey
    );
    const enrollByEnrollmentClassTypeKey = buildAttendanceAbsenceKey(
      sapId,
      courseNorm,
      originalEventPackageId,
      classTypeKey || "na"
    );
    const enrollFallbackClassKey = buildAttendanceAbsenceKey(
      sapId,
      courseNorm,
      originalEventPackageId,
      "na"
    );
    const absencePackageKey = `${sapId}__${courseNorm}__${originalEventPackageId}`;
    const totalHeld = pair.held;
    const attendanceMarked = pair.marked;
    const absences =
      absencesByEnrollmentClassKey.get(enrollClassKey) ??
      absencesByEnrollmentClassKey.get(enrollByEnrollmentClassTypeKey) ??
      absencesByCoursePackage.get(absencePackageKey) ??
      absencesByEnrollmentClassKey.get(enrollFallbackClassKey) ??
      0;
    // Monitoring: Held → total_classes_held, Att → attendance_marked_classes (same credit-hours key as SAP CrHr).
    const attended = Math.max(0, attendanceMarked - absences);
    const pct =
      attendanceMarked > 0 ? (attended / attendanceMarked) * 100 : null;

    attendancePctByEnrollmentKey.set(
      `${sapId}__${courseNorm}__${eventPackageId}`,
      pct
    );
    if (pct != null && Number.isFinite(pct)) {
      classSumByCourseSectionCredit.set(
        monitoringRowKey,
        (classSumByCourseSectionCredit.get(monitoringRowKey) ?? 0) + pct
      );
      classCountByCourseSectionCredit.set(
        monitoringRowKey,
        (classCountByCourseSectionCredit.get(monitoringRowKey) ?? 0) + 1
      );
    }
  }

  const classAvgByCourseSectionCredit = new Map<string, number>();
  for (const [k, sum] of classSumByCourseSectionCredit.entries()) {
    const count = classCountByCourseSectionCredit.get(k) ?? 1;
    classAvgByCourseSectionCredit.set(k, sum / count);
  }

  const sapIds = Array.from(new Set(prepared.map((r) => r.sapId)));
  const gpaTrendMap = await getGpaTrendMapBySapIds(sapIds);

  const studentRows = Array.from(
    new Map(prepared.map((r) => [r.sapId, { sapId: r.sapId, name: r.studentName }])).values()
  );
  const facultyRows = Array.from(
    new Map(prepared.map((r) => [r.facultyId, { id: r.facultyId, name: `Faculty ${r.facultyId}` }])).values()
  );
  const deptRows = Array.from(
    new Map(
      prepared.map((r) => [
        r.departmentId,
        { id: r.departmentId, code: r.departmentCode, name: r.departmentName, facultyId: r.facultyId },
      ])
    ).values()
  );
  const programRows = Array.from(
    new Map(
      prepared
        .filter((r) => r.programId)
        .map((r) => [
          r.programId!,
          {
            id: r.programId!,
            title: r.programTitle || r.programId!,
            facultyId: r.facultyId,
            departmentId: r.departmentId,
          },
        ])
    ).values()
  );
  const courseRows = Array.from(
    new Map(
      prepared.map((r) => [
        r.courseId,
        {
          id: r.courseId,
          title: r.courseTitle,
          facultyId: r.facultyId,
          departmentId: r.departmentId,
          programId: r.programId,
        },
      ])
    ).values()
  );

  let scopedFacultyIds: string[] = [];

  await pool.query("BEGIN");
  try {
    for (const chunk of chunkArray(facultyRows, 1000)) {
      const values: unknown[] = [];
      for (const row of chunk) values.push(row.id, row.name);
      const placeholders = buildMultiInsertPlaceholders(chunk.length, 2);
      await pool.query(
        `INSERT INTO faculties (id, name)
         VALUES ${placeholders}
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           updated_at = NOW()`,
        values
      );
    }

    for (const chunk of chunkArray(deptRows, 1000)) {
      const values: unknown[] = [];
      for (const row of chunk) values.push(row.id, row.code, row.name, row.facultyId);
      const placeholders = buildMultiInsertPlaceholders(chunk.length, 4);
      await pool.query(
        `INSERT INTO departments (id, code, name, faculty_id)
         VALUES ${placeholders}
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           faculty_id = EXCLUDED.faculty_id,
           updated_at = NOW()`,
        values
      );
    }

    for (const chunk of chunkArray(programRows, 1000)) {
      const values: unknown[] = [];
      for (const row of chunk) values.push(row.id, row.title, row.facultyId, row.departmentId);
      const placeholders = buildMultiInsertPlaceholders(chunk.length, 4);
      await pool.query(
        `INSERT INTO programs (id, title, faculty_id, department_id)
         VALUES ${placeholders}
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           faculty_id = EXCLUDED.faculty_id,
           department_id = EXCLUDED.department_id,
           updated_at = NOW()`,
        values
      );
    }

    for (const chunk of chunkArray(courseRows, 1000)) {
      const values: unknown[] = [];
      for (const row of chunk) {
        values.push(row.id, row.title, row.departmentId, row.facultyId, row.programId);
      }
      const placeholders = buildMultiInsertPlaceholders(chunk.length, 5);
      await pool.query(
        `INSERT INTO courses (id, title, department_id, faculty_id, program_id)
         VALUES ${placeholders}
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           department_id = EXCLUDED.department_id,
           faculty_id = EXCLUDED.faculty_id,
           program_id = EXCLUDED.program_id,
           updated_at = NOW()`,
        values
      );
    }

    for (const chunk of chunkArray(studentRows, 2000)) {
      const values: unknown[] = [];
      for (const row of chunk) values.push(row.sapId, row.name);
      const placeholders = buildMultiInsertPlaceholders(chunk.length, 2);
      await pool.query(
        `INSERT INTO students (sap_id, full_name)
         VALUES ${placeholders}
         ON CONFLICT (sap_id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           updated_at = NOW()`,
        values
      );
    }

    const requestedFacultyIds = (options?.facultyIds ?? [])
      .map((v) => String(v).trim())
      .filter(Boolean);
    const preparedFacultyIds = Array.from(
      new Set(prepared.map((row) => row.facultyId).filter(Boolean))
    );
    scopedFacultyIds = Array.from(
      new Set(
        requestedFacultyIds.length ? requestedFacultyIds : preparedFacultyIds
      )
    );
    if (scopedFacultyIds.length) {
      await pool.query(
        `UPDATE student_enrollment_current
         SET is_active = FALSE
         WHERE faculty_id = ANY($1::text[])`,
        [scopedFacultyIds]
      );
    }

    for (const row of prepared) {
      await pool.query(
        `INSERT INTO student_enrollment_current (
           sap_id, student_name, faculty_id, department_id, program_id, course_id,
           section_code, event_package_id, instructor_pernr, instructor_name, instructor_email,
           term_year, term_session, admission_year, admission_period_id, admission_session,
           campus_code, is_active, snapshot_at
         )
         VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,TRUE,NOW()
         )
         ON CONFLICT (sap_id, course_id, section_code, event_package_id) DO UPDATE SET
           student_name = EXCLUDED.student_name,
           faculty_id = EXCLUDED.faculty_id,
           department_id = EXCLUDED.department_id,
           program_id = EXCLUDED.program_id,
           instructor_pernr = EXCLUDED.instructor_pernr,
           instructor_name = EXCLUDED.instructor_name,
           instructor_email = EXCLUDED.instructor_email,
           term_year = EXCLUDED.term_year,
           term_session = EXCLUDED.term_session,
           admission_year = EXCLUDED.admission_year,
           admission_period_id = EXCLUDED.admission_period_id,
           admission_session = EXCLUDED.admission_session,
           campus_code = EXCLUDED.campus_code,
           is_active = TRUE,
           snapshot_at = NOW(),
           updated_at = NOW()`,
        [
          row.sapId,
          row.studentName,
          row.facultyId,
          row.departmentId,
          row.programId,
          row.courseId,
          row.sectionCode,
          row.eventPackageId,
          row.instructorPernr,
          row.instructorName,
          row.instructorEmail,
          row.termYear,
          row.termSession,
          row.admissionYear,
          row.admissionPeriodId,
          row.admissionSession,
          row.campusCode,
        ]
      );
    }

    type AlertPrepared = {
      sapId: string;
      courseId: string;
      sectionCode: string;
      eventPackageId: string;
      facultyId: string;
      departmentId: string;
      programId: string | null;
      instructorPernr: string | null;
      totalHeld: number;
      attendanceMarked: number;
      attendanceNotUpdated: number;
      attended: number;
      attendancePct: number | null;
      classAvg: number | null;
      deviation: number | null;
      attendanceLevel: "warning" | "critical" | null;
      gpaCurrent: number | null;
      gpaPrevious: number | null;
      gpaChange: number | null;
      gpaLevel: "warning" | "critical" | null;
      overall: "none" | "warning" | "critical";
    };

    const alerts: AlertPrepared[] = prepared.map((row) => {
      const courseNorm = normalizeCourseCode(row.courseId);
      const enrollClassKey = buildAttendanceAbsenceKey(
        row.sapId,
        courseNorm,
        row.originalEventPackageId,
        row.creditHoursKey
      );
      const enrollFallbackClassKey = buildAttendanceAbsenceKey(
        row.sapId,
        courseNorm,
        row.originalEventPackageId,
        "na"
      );
      const monitoringRowKey = buildCourseSectionCreditKey(
        courseNorm,
        row.sectionCode,
        row.creditHoursKey
      );
      const pair =
        monitoringByCourseSectionCredit.get(monitoringRowKey) ?? { held: 0, marked: 0 };
      const totalHeld = pair.held;
      const attendanceMarked = pair.marked;
      const enrollByEnrollmentClassTypeKey = buildAttendanceAbsenceKey(
        row.sapId,
        courseNorm,
        row.originalEventPackageId,
        row.classTypeKey || "na"
      );
      const absencePackageKey = `${row.sapId}__${courseNorm}__${row.originalEventPackageId}`;
      const attendanceNotUpdated = Math.max(0, totalHeld - attendanceMarked);
      const absences =
        absencesByEnrollmentClassKey.get(enrollClassKey) ??
        absencesByEnrollmentClassKey.get(enrollByEnrollmentClassTypeKey) ??
        absencesByCoursePackage.get(absencePackageKey) ??
        absencesByEnrollmentClassKey.get(enrollFallbackClassKey) ??
        0;
      // Same rule as the enrollment loop: % uses posted classes (Att), not Held.
      const attended = Math.max(0, attendanceMarked - absences);
      const attendancePct =
        attendanceMarked > 0 ? (attended / attendanceMarked) * 100 : null;
      const classAvg = classAvgByCourseSectionCredit.get(monitoringRowKey) ?? null;
      const attendanceLevel =
        attendancePct == null
          ? null
          : getAttendanceAlertLevel(attendancePct, classAvg, attendanceMarked);
      // GPA trend map is SGPA-based for alerting.
      const gpaTrend = gpaTrendMap[row.sapId];
      const gpaCurrent = gpaTrend?.current ?? null;
      const gpaPrevious = gpaTrend?.previous ?? null;
      const gpaChange = gpaTrend?.change ?? null;
      const gpaDrop = Math.abs(Math.min(0, gpaChange ?? 0));
      const gpaLevel: "warning" | "critical" | null =
        gpaDrop >= SGPA_CRITICAL_DROP
          ? "critical"
          : gpaDrop >= SGPA_WARNING_DROP
            ? "warning"
            : null;
      const overall: "none" | "warning" | "critical" =
        attendanceLevel === "critical" || gpaLevel === "critical"
          ? "critical"
          : attendanceLevel === "warning" || gpaLevel === "warning"
            ? "warning"
            : "none";
      return {
        sapId: row.sapId,
        courseId: row.courseId,
        sectionCode: row.sectionCode,
        eventPackageId: row.eventPackageId,
        facultyId: row.facultyId,
        departmentId: row.departmentId,
        programId: row.programId,
        instructorPernr: row.instructorPernr,
        totalHeld,
        attendanceMarked,
        attendanceNotUpdated,
        attended,
        attendancePct,
        classAvg,
        deviation:
          classAvg == null || attendancePct == null
            ? null
            : classAvg - attendancePct,
        attendanceLevel,
        gpaCurrent,
        gpaPrevious,
        gpaChange,
        gpaLevel,
        overall,
      };
    });

    for (const row of alerts) {
      await pool.query(
        `INSERT INTO student_alert_current (
           sap_id, course_id, section_code, event_package_id,
           faculty_id, department_id, program_id, instructor_pernr,
           total_classes_held, attendance_marked_classes, attendance_not_updated_classes,
           classes_attended, attendance_percentage,
           class_average_attendance, attendance_deviation, gpa_current, gpa_previous, gpa_change,
           attendance_alert_level, gpa_alert_level, overall_alert_level,
           computed_at
         )
         VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW()
         )
         ON CONFLICT (sap_id, course_id, section_code, event_package_id) DO UPDATE SET
           faculty_id = EXCLUDED.faculty_id,
           department_id = EXCLUDED.department_id,
           program_id = EXCLUDED.program_id,
           instructor_pernr = EXCLUDED.instructor_pernr,
           total_classes_held = EXCLUDED.total_classes_held,
           attendance_marked_classes = EXCLUDED.attendance_marked_classes,
           attendance_not_updated_classes = EXCLUDED.attendance_not_updated_classes,
           classes_attended = EXCLUDED.classes_attended,
           attendance_percentage = EXCLUDED.attendance_percentage,
           class_average_attendance = EXCLUDED.class_average_attendance,
           attendance_deviation = EXCLUDED.attendance_deviation,
           gpa_current = EXCLUDED.gpa_current,
           gpa_previous = EXCLUDED.gpa_previous,
           gpa_change = EXCLUDED.gpa_change,
           attendance_alert_level = EXCLUDED.attendance_alert_level,
           gpa_alert_level = EXCLUDED.gpa_alert_level,
           overall_alert_level = EXCLUDED.overall_alert_level,
           computed_at = NOW(),
           updated_at = NOW()`,
        [
          row.sapId,
          row.courseId,
          row.sectionCode,
          row.eventPackageId,
          row.facultyId,
          row.departmentId,
          row.programId,
          row.instructorPernr,
          row.totalHeld,
          row.attendanceMarked,
          row.attendanceNotUpdated,
          row.attended,
          row.attendancePct,
          row.classAvg,
          row.deviation,
          row.gpaCurrent,
          row.gpaPrevious,
          row.gpaChange,
          row.attendanceLevel,
          row.gpaLevel,
          row.overall,
        ]
      );
    }

    await pool.query("COMMIT");

    let upsertedDailySnapshots = 0;
    if (scopedFacultyIds.length) {
      upsertedDailySnapshots = await upsertStudentAlertDailySnapshot(date, {
        facultyIds: scopedFacultyIds,
      });
    }

    return {
      snapshotDate: date,
      sourceEnrollmentRows: sourceEnrollments.length,
      sourceAttendanceRows: attendanceRows.length,
      sourceMonitoringRows: monitoringEntries.length,
      upsertedStudents: studentRows.length,
      upsertedEnrollments: prepared.length,
      upsertedAlerts: prepared.length,
      upsertedDailySnapshots,
    };
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}
