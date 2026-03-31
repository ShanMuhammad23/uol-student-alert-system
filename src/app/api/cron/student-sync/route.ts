import { NextRequest, NextResponse } from "next/server";
import { runStudentSync } from "@/lib/student-sync";

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
    const result = await runStudentSync();
    return NextResponse.json(
      {
        ok: true,
        snapshot_date: result.snapshotDate,
        source_enrollment_rows: result.sourceEnrollmentRows,
        source_attendance_rows: result.sourceAttendanceRows,
        source_monitoring_rows: result.sourceMonitoringRows,
        upserted_students: result.upsertedStudents,
        upserted_enrollments: result.upsertedEnrollments,
        upserted_alerts: result.upsertedAlerts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/cron/student-sync:", error);
    return NextResponse.json(
      { error: "Failed to sync student enrollment and alerts" },
      { status: 500 }
    );
  }
}
