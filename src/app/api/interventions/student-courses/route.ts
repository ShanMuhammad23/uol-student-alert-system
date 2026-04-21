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
    session.user.role !== "wellbeing" &&
    session.user.role !== "wellbeing-head" &&
    session.user.role !== "wellbeing-counseller"
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
      faculty_name: string | null;
      department_name: string | null;
      degree_title: string | null;
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
           COALESCE(faculty_id, '') AS faculty_id,
           COALESCE(department_id, '') AS department_id,
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
         COALESCE(NULLIF(TRIM(f.name), ''), l.faculty_id) AS faculty_name,
         COALESCE(NULLIF(TRIM(d.name), ''), l.department_id) AS department_name,
         COALESCE(NULLIF(TRIM(p.title), ''), ec.program_id) AS degree_title,
         l.section_code,
         l.event_package_id,
         l.status,
         l.performed_at::text
       FROM latest l
       LEFT JOIN courses c ON c.id = l.course_id
       LEFT JOIN student_enrollment_current ec
         ON ec.sap_id = l.student_sap_id
        AND ec.course_id = l.course_id
        AND ec.section_code = COALESCE(l.section_code, '')
        AND ec.event_package_id = COALESCE(l.event_package_id, '')
        AND ec.is_active = TRUE
       LEFT JOIN faculties f
         ON f.id = COALESCE(ec.faculty_id, l.faculty_id)
       LEFT JOIN departments d
         ON d.id = COALESCE(ec.department_id, l.department_id)
       LEFT JOIN programs p
         ON p.id = ec.program_id
       WHERE l.course_id <> ''
       ORDER BY l.course_id ASC, l.section_code ASC, l.event_package_id ASC`,
      [sapId]
    );

    return NextResponse.json(
      {
        rows: res.rows.map((r) => ({
          courseId: r.course_id,
          courseTitle: r.course_title ?? null,
          facultyName: r.faculty_name ?? null,
          departmentName: r.department_name ?? null,
          degreeTitle: r.degree_title ?? null,
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
