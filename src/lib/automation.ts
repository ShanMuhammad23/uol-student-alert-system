import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { pool } from "@/lib/db";

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

export async function getLastAlertSnapshotUpdateAt(): Promise<string | null> {
  if (!pool) return null;
  // Prefer updated_at so reruns on existing snapshot_date still move the "last update" clock.
  // Fall back to created_at for compatibility with older schema/data.
  const res = await pool.query<{ last_update_at: string | null }>(
    `SELECT MAX(COALESCE(updated_at, created_at))::text AS last_update_at
     FROM alert_counts_by_dimension`
  );
  return res.rows[0]?.last_update_at ?? null;
}

