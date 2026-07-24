import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { pool } from "@/lib/db";
import type { EtlRunRow } from "@/lib/etl-run-types";

export type { EtlRunRow } from "@/lib/etl-run-types";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "automation-etl.log");
const PID_FILE = path.join(LOG_DIR, "automation-etl.pid");

async function ensureLogDir() {
  await fs.mkdir(LOG_DIR, { recursive: true });
}

async function appendLog(line: string) {
  await ensureLogDir();
  await fs.appendFile(LOG_FILE, `${line}\n`, "utf8");
}

function timestamp() {
  return new Date().toISOString();
}

async function readPid(): Promise<number | null> {
  try {
    const raw = await fs.readFile(PID_FILE, "utf8");
    const pid = Number(raw.trim());
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function pidIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function isAutomationRunning(): Promise<boolean> {
  const pid = await readPid();
  if (!pid) return false;
  const running = pidIsRunning(pid);
  if (!running) {
    await fs.unlink(PID_FILE).catch(() => undefined);
  }
  return running;
}

export async function startEtlAutomationRun(): Promise<{ started: boolean; message: string }> {
  if (await isAutomationRunning()) {
    return { started: false, message: "ETL run is already in progress." };
  }

  await ensureLogDir();
  await appendLog(`[${timestamp()}] Requested ETL run from dashboard`);

  const script =
    process.platform === "win32" ? "run-daily-etl.ps1" : "run-daily-etl.sh";
  const command =
    process.platform === "win32" ? "powershell.exe" : "bash";
  const args =
    process.platform === "win32"
      ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script]
      : [script];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", async (chunk) => {
    await appendLog(String(chunk).replace(/\r?\n$/, ""));
  });
  child.stderr?.on("data", async (chunk) => {
    await appendLog(`[stderr] ${String(chunk).replace(/\r?\n$/, "")}`);
  });
  child.on("close", async (code) => {
    await appendLog(`[${timestamp()}] ETL run finished with exit code ${code ?? -1}`);
    await fs.unlink(PID_FILE).catch(() => undefined);
  });

  child.unref();
  await fs.writeFile(PID_FILE, String(child.pid), "utf8");
  return { started: true, message: "ETL run started." };
}

export async function readAutomationLogs(lineLimit = 400): Promise<string[]> {
  try {
    const raw = await fs.readFile(LOG_FILE, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.slice(-lineLimit);
  } catch {
    return [];
  }
}

export async function listEtlRuns(limit = 50): Promise<EtlRunRow[]> {
  if (!pool) return [];
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);
  const res = await pool.query<{
    id: string;
    pipeline_name: string;
    started_at: string;
    completed_at: string | null;
    status: EtlRunRow["status"];
    source_rows_enrollment: string | number;
    source_rows_attendance: string | number;
    source_rows_monitoring: string | number;
    produced_rows_current: string | number;
    produced_rows_daily: string | number;
    error_message: string | null;
  }>(
    `SELECT
       id,
       pipeline_name,
       started_at::text AS started_at,
       completed_at::text AS completed_at,
       status,
       source_rows_enrollment,
       source_rows_attendance,
       source_rows_monitoring,
       produced_rows_current,
       produced_rows_daily,
       error_message
     FROM etl_runs
     ORDER BY started_at DESC, id DESC
     LIMIT $1`,
    [safeLimit]
  );

  return res.rows.map((row) => ({
    id: Number(row.id),
    pipelineName: row.pipeline_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    sourceRowsEnrollment: Number(row.source_rows_enrollment ?? 0),
    sourceRowsAttendance: Number(row.source_rows_attendance ?? 0),
    sourceRowsMonitoring: Number(row.source_rows_monitoring ?? 0),
    producedRowsCurrent: Number(row.produced_rows_current ?? 0),
    producedRowsDaily: Number(row.produced_rows_daily ?? 0),
    errorMessage: row.error_message,
  }));
}

export async function getLastAlertSnapshotUpdateAt(): Promise<string | null> {
  if (!pool) return null;
  // Prefer updated_at so reruns on existing snapshot_date still move the "last update" clock.
  // Fall back to created_at for compatibility with older schema/data.
  const { rows: columnRows } = await pool.query<{ has_updated_at: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'alert_counts_by_dimension'
          AND column_name = 'updated_at'
      ) AS has_updated_at
    `
  );
  const hasUpdatedAt = Boolean(columnRows[0]?.has_updated_at);
  const res = await pool.query<{ last_update_at: string | null }>(
    hasUpdatedAt
      ? `SELECT MAX(COALESCE(updated_at, created_at))::text AS last_update_at
         FROM alert_counts_by_dimension`
      : `SELECT MAX(created_at)::text AS last_update_at
         FROM alert_counts_by_dimension`
  );
  return res.rows[0]?.last_update_at ?? null;
}

