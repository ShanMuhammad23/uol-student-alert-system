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
    const queryFacultyId = req.nextUrl.searchParams.get("facultyId")?.trim();
    const queryFacultyIds = req.nextUrl.searchParams
      .get("facultyIds")
      ?.split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const queryFacultyCode = req.nextUrl.searchParams.get("enrollmentFacultyId")?.trim();
    const queryFacultyCodes = req.nextUrl.searchParams
      .get("enrollmentFacultyIds")
      ?.split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    let bodyFacultyId: string | null = null;
    let bodyFacultyIds: string[] = [];
    let bodyFacultyCode: string | null = null;
    let bodyFacultyCodes: string[] = [];
    try {
      const body = await req.json();
      bodyFacultyId =
        typeof body?.facultyId === "string" ? body.facultyId.trim() : null;
      bodyFacultyIds = Array.isArray(body?.facultyIds)
        ? body.facultyIds.map((v: unknown) => String(v).trim()).filter(Boolean)
        : [];
      bodyFacultyCode =
        typeof body?.enrollmentFacultyId === "string"
          ? body.enrollmentFacultyId.trim()
          : null;
      bodyFacultyCodes = Array.isArray(body?.enrollmentFacultyIds)
        ? body.enrollmentFacultyIds.map((v: unknown) => String(v).trim()).filter(Boolean)
        : [];
    } catch {
      // Allow empty or non-JSON body for cron calls.
    }

    const enrollmentFacultyCodes = Array.from(
      new Set(
        [
          queryFacultyCode,
          ...(queryFacultyCodes ?? []),
          bodyFacultyCode,
          ...bodyFacultyCodes,
        ].filter(Boolean) as string[]
      )
    );
    const facultyIds = Array.from(
      new Set(
        [queryFacultyId, ...(queryFacultyIds ?? []), bodyFacultyId, ...bodyFacultyIds].filter(
          Boolean
        ) as string[]
      )
    );

    const result = await runStudentSync(undefined, {
      enrollmentFacultyCodes,
      facultyIds,
    });
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
