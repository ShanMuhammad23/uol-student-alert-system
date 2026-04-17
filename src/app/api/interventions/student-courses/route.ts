import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { pool } from "@/lib/db";

function classTypeFromEventPackage(value: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "N/A";
  const lower = raw.toLowerCase();
  if (lower.includes("lect")) return "LECT";
  if (lower.includes("lab")) return "LAB";
  if (lower.includes("tut")) return "TUT";
  return raw;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    session.user.role !== "superadmin" &&
    session.user.role !== "dean" &&
    session.user.role !== "hod" &&
    session.user.role !== "instructor" &&
    session.user.role !== "wellbeing"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const sapId = String(searchParams.get("sapId") ?? "").trim();
  if (!sapId) {
    return NextResponse.json({ error: "sapId is required" }, { status: 400 });
  }

  try {
    const res = await pool.query<{
      course_id: string;
      course_title: string | null;
      section_code: string | null;
      event_package_id: string | null;
      status: string | null;
      performed_at: string | null;
    }>(
      `WITH latest AS (
         SELECT DISTINCT ON (
           student_sap_id,
           COALESCE(course_id, ''),
           COALESCE(section_code, ''),
           COALESCE(event_package_id, '')
         )
           student_sap_id,
           COALESCE(course_id, '') AS course_id,
           NULLIF(COALESCE(section_code, ''), '') AS section_code,
           NULLIF(COALESCE(event_package_id, ''), '') AS event_package_id,
           status,
           performed_at
         FROM interventions
         WHERE student_sap_id = $1
         ORDER BY
           student_sap_id,
           COALESCE(course_id, ''),
           COALESCE(section_code, ''),
           COALESCE(event_package_id, ''),
           performed_at DESC
       )
       SELECT
         l.course_id,
         c.title AS course_title,
         l.section_code,
         l.event_package_id,
         l.status,
         l.performed_at::text
       FROM latest l
       LEFT JOIN courses c ON c.id = l.course_id
       WHERE l.course_id <> ''
       ORDER BY l.course_id ASC, l.section_code ASC, l.event_package_id ASC`,
      [sapId]
    );

    return NextResponse.json(
      {
        rows: res.rows.map((r) => ({
          courseId: r.course_id,
          courseTitle: r.course_title ?? null,
          sectionCode: r.section_code ?? null,
          eventPackageId: r.event_package_id ?? null,
          classType: classTypeFromEventPackage(r.event_package_id ?? null),
          latestStatus: r.status ?? null,
          latestInterventionAt: r.performed_at ?? null,
        })),
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Intervention student search API error:", e);
    return NextResponse.json(
      { error: "Failed to load intervention courses for student" },
      { status: 500 }
    );
  }
}
