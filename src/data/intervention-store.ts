"use server";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { pool } from "@/lib/db";
import {
  ensureCourseExists,
  insertIntervention,
  getInterventionsByStudentSapIdFromDb,
  getLatestInterventionStatusMapFromDb,
  getInterventionStatsForStudentsFromDb,
} from "@/lib/db/interventions";

/** Matches Intervention-Form fields for intervention history. */
export type InterventionRecord = {
  id: string;
  student_sap_id: string;
  date: string; // YYYY-MM-DD
  outreach_mode: string; // email | phone-call | meeting
  remarks: string;
  status: string; // initiated | in-progress | referred | resolved
  performed_at: string; // ISO date
};

const STORE_DIR = ".data";
const STORE_FILENAME = "intervention-store.json";

function getStorePath(): string {
  return path.join(process.cwd(), STORE_DIR, STORE_FILENAME);
}

type EnrollmentRow = { SapNo?: string; DeptId?: string; FacId?: string; CrCode?: string; CrTitle?: string };

function readEnrollmentForStudent(sapId: string): EnrollmentRow | null {
  const dataPath = path.join(process.cwd(), "public", "enrollment_data.json");
  if (!existsSync(dataPath)) return null;
  try {
    const raw = readFileSync(dataPath, "utf-8");
    const data = JSON.parse(raw) as EnrollmentRow[];
    const list = Array.isArray(data) ? data : [];
    const first = list.find((r) => String(r.SapNo ?? "") === String(sapId));
    return first ?? null;
  } catch {
    return null;
  }
}

function readStore(): InterventionRecord[] {
  const storePath = getStorePath();
  if (!existsSync(storePath)) return [];
  try {
    const raw = readFileSync(storePath, "utf-8");
    const data = JSON.parse(raw) as InterventionRecord[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** All interventions for a student, newest first. Uses DB when available, else file. */
export async function getInterventionsByStudentSapId(
  sapId: string
): Promise<InterventionRecord[]> {
  if (pool) {
    const rows = await getInterventionsByStudentSapIdFromDb(sapId);
    return rows as InterventionRecord[];
  }
  const stored = readStore();
  return stored
    .filter((r) => r.student_sap_id === sapId)
    .sort(
      (a, b) =>
        new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
    );
}

/** Latest intervention status for this student (for badge). Returns null when no intervention. */
export async function getLatestInterventionStatusForStudent(
  sapId: string
): Promise<string | null> {
  const list = await getInterventionsByStudentSapId(sapId);
  return list.length > 0 ? list[0].status : null;
}

/** Batch: latest intervention status per student. Use when rendering many students to avoid N async calls. */
export async function getLatestInterventionStatusMap(
  sapIds: string[]
): Promise<Map<string, string | null>> {
  if (pool && sapIds.length > 0) {
    return getLatestInterventionStatusMapFromDb(sapIds);
  }
  const stored = readStore();
  const latestBySapId = new Map<string, InterventionRecord>();
  for (const r of stored) {
    const existing = latestBySapId.get(r.student_sap_id);
    if (
      !existing ||
      new Date(r.performed_at).getTime() > new Date(existing.performed_at).getTime()
    ) {
      latestBySapId.set(r.student_sap_id, r);
    }
  }
  const map = new Map<string, string | null>();
  for (const sapId of sapIds) {
    const record = latestBySapId.get(sapId);
    map.set(sapId, record?.status ?? null);
  }
  return map;
}

export type InterventionStatsCounts = {
  notStarted: number;
  initiated: number;
  "in-progress": number;
  referred: number;
  resolved: number;
};

/**
 * For a given set of student SAP IDs (e.g. all students in alert for the user),
 * returns counts per intervention status. "Not Started" = in alert but no action taken.
 * Sum of all counts equals sapIds.length.
 */
export async function getInterventionStatsForStudents(
  sapIds: string[]
): Promise<InterventionStatsCounts> {
  if (pool && sapIds.length > 0) {
    return getInterventionStatsForStudentsFromDb(sapIds);
  }
  const stored = readStore();
  const latestBySapId = new Map<string, InterventionRecord>();
  for (const r of stored) {
    const existing = latestBySapId.get(r.student_sap_id);
    if (
      !existing ||
      new Date(r.performed_at).getTime() > new Date(existing.performed_at).getTime()
    ) {
      latestBySapId.set(r.student_sap_id, r);
    }
  }
  let notStarted = 0;
  let initiated = 0;
  let inProgress = 0;
  let referred = 0;
  let resolved = 0;
  for (const sapId of sapIds) {
    const record = latestBySapId.get(sapId);
    const status = record?.status ?? null;
    if (status === null) notStarted += 1;
    else if (status === "initiated") initiated += 1;
    else if (status === "in-progress") inProgress += 1;
    else if (status === "referred") referred += 1;
    else if (status === "resolved") resolved += 1;
    else notStarted += 1;
  }
  return {
    notStarted,
    initiated,
    "in-progress": inProgress,
    referred,
    resolved,
  };
}

export async function recordIntervention(
  studentSapId: string,
  data: {
    date: string;
    outreach_mode: string;
    remarks: string;
    status: string;
  }
): Promise<void> {
  if (pool) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error("You must be signed in to record an intervention.");
    }
    // Student context from enrollment_data.json only (SapNo, DeptId, FacId, CrCode).
    const enrollment = readEnrollmentForStudent(studentSapId);
    if (!enrollment?.DeptId || !enrollment?.FacId) {
      throw new Error(
        "Student not found in enrollment. Ensure enrollment_data.json contains this student (SapNo) with DeptId and FacId."
      );
    }
    const departmentId = enrollment.DeptId;
    const facultyId = enrollment.FacId;
    const courseId = (enrollment.CrCode ?? "").trim() || "unknown";
    const courseTitle = enrollment.CrTitle as string | undefined;
    await ensureCourseExists(courseId, {
      title: courseTitle,
      departmentId,
      facultyId,
    });
    const performedAt = new Date().toISOString();
    await insertIntervention({
      id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      student_sap_id: studentSapId,
      date: data.date,
      outreach_mode: data.outreach_mode,
      remarks: data.remarks ?? "",
      status: data.status,
      performed_at: performedAt,
      staff_id: session.user.id,
      department_id: departmentId,
      course_id: courseId,
      faculty_id: facultyId,
    });
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath(`/students/${studentSapId}`);
    return;
  }
  const stored = readStore();
  const record: InterventionRecord = {
    id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    student_sap_id: studentSapId,
    date: data.date,
    outreach_mode: data.outreach_mode,
    remarks: data.remarks,
    status: data.status,
    performed_at: new Date().toISOString(),
  };
  stored.push(record);
  const storePath = getStorePath();
  const dir = path.dirname(storePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(storePath, JSON.stringify(stored, null, 2), "utf-8");
  revalidatePath("/");
  revalidatePath(`/students/${studentSapId}`);
}
