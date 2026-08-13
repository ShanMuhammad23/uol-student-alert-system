import { NextRequest, NextResponse } from "next/server";
import { runMissingAttendanceReminders } from "@/lib/missing-attendance-reminders";

export const dynamic = "force-dynamic";
/** Bulk sends wait 5s between each message; allow long-running cron calls. */
export const maxDuration = 3600;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const cronHeader = req.headers.get("x-cron-secret");
  return cronHeader === secret;
}

function parsePositiveInt(value: string | null | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queryFacultyId = req.nextUrl.searchParams.get("facultyId")?.trim();
    const querySnapshotDate = req.nextUrl.searchParams.get("snapshotDate")?.trim();
    const queryMinMissing = req.nextUrl.searchParams.get("minMissing");
    const queryDryRun = req.nextUrl.searchParams.get("dryRun");

    let bodyFacultyId: string | null = null;
    let bodySnapshotDate: string | null = null;
    let bodyMinMissing: number | undefined;
    let bodyDryRun: boolean | undefined;

    try {
      const body = await req.json();
      bodyFacultyId =
        typeof body?.facultyId === "string" ? body.facultyId.trim() : null;
      bodySnapshotDate =
        typeof body?.snapshotDate === "string" ? body.snapshotDate.trim() : null;
      if (body?.minMissingEntries != null) {
        bodyMinMissing = parsePositiveInt(String(body.minMissingEntries), 4);
      }
      if (typeof body?.dryRun === "boolean") {
        bodyDryRun = body.dryRun;
      }
    } catch {
      // Allow empty body for cron calls.
    }

    // Empty / omitted facultyId = all faculties with current-semester enrollment.
    const facultyId =
      queryFacultyId ||
      bodyFacultyId ||
      process.env.MISSING_ATTENDANCE_FACULTY_ID?.trim() ||
      undefined;
    const snapshotDate =
      querySnapshotDate || bodySnapshotDate || undefined;
    const minMissingEntries = parsePositiveInt(
      queryMinMissing ?? (bodyMinMissing != null ? String(bodyMinMissing) : null),
      parsePositiveInt(process.env.MISSING_ATTENDANCE_MIN_MISSING ?? "4", 4)
    );
    const dryRun =
      bodyDryRun ??
      (queryDryRun === "1" ||
        queryDryRun === "true" ||
        String(process.env.MISSING_ATTENDANCE_DRY_RUN ?? "").toLowerCase() ===
          "true");

    const result = await runMissingAttendanceReminders({
      facultyId,
      snapshotDate,
      minMissingEntries,
      dryRun,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/cron/missing-attendance-reminders:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send missing attendance reminders",
      },
      { status: 500 }
    );
  }
}
