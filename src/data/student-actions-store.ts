import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import {
  DUMMY_ACTIONS,
  type StudentAction,
  type StudentActionType,
  type StudentActionResult,
} from "./student-actions";

const STORE_DIR = ".data";
const STORE_FILENAME = "student-actions-store.json";

function getStorePath(): string {
  return path.join(process.cwd(), STORE_DIR, STORE_FILENAME);
}

function readStore(): StudentAction[] {
  const storePath = getStorePath();
  if (!existsSync(storePath)) return [];
  try {
    const raw = readFileSync(storePath, "utf-8");
    const data = JSON.parse(raw) as StudentAction[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeStore(actions: StudentAction[]): void {
  const storePath = getStorePath();
  const dir = path.dirname(storePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(storePath, JSON.stringify(actions, null, 2), "utf-8");
}

/** All actions for a student (dummy + stored), newest first. */
export function getMergedActionsByStudentSapId(sapId: string): StudentAction[] {
  const stored = readStore();
  const merged = [...DUMMY_ACTIONS, ...stored];
  return merged
    .filter((a) => a.student_sap_id === sapId)
    .sort(
      (a, b) =>
        new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
    );
}

/** Latest result for this student from merged actions. */
export function getMergedLatestResultForStudent(
  sapId: string
): StudentActionResult | null {
  const actions = getMergedActionsByStudentSapId(sapId);
  return actions.length > 0 ? actions[0].result : null;
}

export function recordStudentAction(
  studentSapId: string,
  actionType: StudentActionType,
  result: StudentActionResult = "improved"
): void {
  const stored = readStore();
  const newAction: StudentAction = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    student_sap_id: studentSapId,
    action_type: actionType,
    result,
    performed_at: new Date().toISOString(),
  };
  stored.push(newAction);
  writeStore(stored);
  revalidatePath("/");
  revalidatePath(`/students/${studentSapId}`);
}
