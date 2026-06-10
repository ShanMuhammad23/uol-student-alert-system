import { NextRequest, NextResponse } from "next/server";
import { upsertStudentAlertDailySnapshot } from "@/lib/alert-daily-snapshot";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const cronHeader = req.headers.get("x-cron-secret");
  return cronHeader === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queryFacultyIds = req.nextUrl.searchParams
      .get("facultyIds")
      ?.split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const queryFacultyId = req.nextUrl.searchParams.get("facultyId")?.trim();
    let bodyFacultyIds: string[] = [];
    let bodyFacultyId: string | null = null;
    try {
      const body = await req.json();
      bodyFacultyIds = Array.isArray(body?.facultyIds)
        ? body.facultyIds.map((v: unknown) => String(v).trim()).filter(Boolean)
        : [];
      bodyFacultyId = typeof body?.facultyId === "string" ? body.facultyId.trim() : null;
    } catch {
      // Allow empty body.
    }
    const facultyIds = Array.from(
      new Set(
        [queryFacultyId, ...(queryFacultyIds ?? []), bodyFacultyId, ...bodyFacultyIds].filter(
          Boolean
        ) as string[]
      )
    );
    if (!facultyIds.length) {
      return NextResponse.json(
        { error: "facultyIds is required. Global daily alert snapshots are disabled." },
        { status: 400 }
      );
    }

    const snapshotDate = new Date().toISOString().slice(0, 10);
    const upserted = await upsertStudentAlertDailySnapshot(snapshotDate, { facultyIds });

    return NextResponse.json(
      {
        ok: true,
        snapshot_date: snapshotDate,
        upserted_rows: upserted,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error in /api/cron/alert-daily:", error);
    return NextResponse.json(
      { error: "Failed to save student_alert_daily snapshot", detail: message },
      { status: 500 }
    );
  }
}
