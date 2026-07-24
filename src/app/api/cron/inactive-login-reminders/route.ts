import { NextRequest, NextResponse } from "next/server";
import { runInactiveLoginReminders } from "@/lib/inactive-login-reminders";

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
    const queryInactiveDays = req.nextUrl.searchParams.get("inactiveDays");
    const queryDryRun = req.nextUrl.searchParams.get("dryRun");

    let bodyFacultyId: string | null = null;
    let bodyInactiveDays: number | undefined;
    let bodyDryRun: boolean | undefined;

    try {
      const body = await req.json();
      bodyFacultyId =
        typeof body?.facultyId === "string" ? body.facultyId.trim() : null;
      if (body?.inactiveDays != null) {
        bodyInactiveDays = parsePositiveInt(String(body.inactiveDays), 7);
      }
      if (typeof body?.dryRun === "boolean") {
        bodyDryRun = body.dryRun;
      }
    } catch {
      // Allow empty body for cron calls.
    }

    const facultyId =
      queryFacultyId ||
      bodyFacultyId ||
      process.env.INACTIVE_LOGIN_FACULTY_ID?.trim() ||
      undefined;
    const inactiveDays = parsePositiveInt(
      queryInactiveDays ??
        (bodyInactiveDays != null ? String(bodyInactiveDays) : null),
      parsePositiveInt(process.env.INACTIVE_LOGIN_INACTIVE_DAYS ?? "7", 7)
    );
    const dryRun =
      bodyDryRun ??
      (queryDryRun === "1" ||
        queryDryRun === "true" ||
        String(process.env.INACTIVE_LOGIN_DRY_RUN ?? "").toLowerCase() ===
          "true");

    const result = await runInactiveLoginReminders({
      facultyId,
      inactiveDays,
      dryRun,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/cron/inactive-login-reminders:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send inactive login reminders",
      },
      { status: 500 }
    );
  }
}
