import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { pool } from "@/lib/db";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";

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
  const query = String(searchParams.get("query") ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
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
      teacher_name: string | null;
      teacher_pernr: string | null;
      teacher_email: string | null;
      faculty_id: string | null;
    }>(
      `WITH matched_staff AS (
         SELECT id::text AS staff_id, name, pernr, email
         FROM staff
         WHERE
           LOWER(COALESCE(name, '')) LIKE LOWER($1)
           OR LOWER(COALESCE(pernr, '')) LIKE LOWER($1)
       ),
       latest AS (
         SELECT DISTINCT ON (
           i.staff_id,
           COALESCE(NULLIF(TRIM(i.course_id), ''), ''),
           COALESCE(NULLIF(TRIM(i.section_code), ''), ''),
           COALESCE(NULLIF(TRIM(i.event_package_id), ''), '')
         )
           i.staff_id,
           COALESCE(NULLIF(TRIM(i.course_id), ''), '') AS course_id,
           COALESCE(NULLIF(TRIM(i.faculty_id), ''), '') AS faculty_id,
           COALESCE(NULLIF(TRIM(i.department_id), ''), '') AS department_id,
           NULLIF(TRIM(i.section_code), '') AS section_code,
           NULLIF(TRIM(i.event_package_id), '') AS event_package_id,
           i.status,
           i.performed_at,
           ms.name AS teacher_name,
           ms.pernr AS teacher_pernr,
           ms.email AS teacher_email
         FROM interventions i
         INNER JOIN matched_staff ms ON ms.staff_id = i.staff_id::text
         ORDER BY
           i.staff_id,
           COALESCE(NULLIF(TRIM(i.course_id), ''), ''),
           COALESCE(NULLIF(TRIM(i.section_code), ''), ''),
           COALESCE(NULLIF(TRIM(i.event_package_id), ''), ''),
           i.performed_at DESC
       ),
       enrollment_lookup AS (
         SELECT
           ec.course_id,
           ec.section_code,
           ec.event_package_id,
           MAX(NULLIF(TRIM(ec.faculty_id), '')) AS faculty_id,
           MAX(NULLIF(TRIM(ec.department_id), '')) AS department_id,
           MAX(NULLIF(TRIM(ec.program_id), '')) AS program_id
         FROM student_enrollment_current ec
         WHERE ec.is_active = TRUE
         GROUP BY ec.course_id, ec.section_code, ec.event_package_id
       )
       SELECT DISTINCT ON (
         COALESCE(l.teacher_pernr, ''),
         l.course_id,
         COALESCE(l.section_code, ''),
         COALESCE(l.event_package_id, '')
       )
         l.course_id,
         c.title AS course_title,
         l.faculty_id,
         COALESCE(NULLIF(TRIM(f.name), ''), l.faculty_id) AS faculty_name,
         COALESCE(NULLIF(TRIM(d.name), ''), l.department_id) AS department_name,
         COALESCE(NULLIF(TRIM(p.title), ''), ec.program_id) AS degree_title,
         l.section_code,
         l.event_package_id,
         l.status,
         l.performed_at::text,
         l.teacher_name,
         l.teacher_pernr,
         l.teacher_email
       FROM latest l
       LEFT JOIN courses c ON c.id = l.course_id
       LEFT JOIN enrollment_lookup ec
         ON ec.course_id = l.course_id
        AND ec.section_code = COALESCE(l.section_code, '')
        AND ec.event_package_id = COALESCE(l.event_package_id, '')
       LEFT JOIN faculties f
         ON f.id = COALESCE(ec.faculty_id, l.faculty_id)
       LEFT JOIN departments d
         ON d.id = COALESCE(ec.department_id, l.department_id)
       LEFT JOIN programs p
         ON p.id = ec.program_id
       WHERE l.course_id <> ''
       ORDER BY
         COALESCE(l.teacher_pernr, ''),
         l.course_id,
         COALESCE(l.section_code, ''),
         COALESCE(l.event_package_id, ''),
         l.performed_at DESC,
         l.teacher_name ASC NULLS LAST`,
      [`%${query}%`]
    );

    return NextResponse.json(
      {
        rows: res.rows.map((r) => ({
          courseId: r.course_id,
          courseTitle: r.course_title ?? null,
          facultyName: resolveFacultyNameFromIdOrName(
            r.faculty_id ?? null,
            r.faculty_name ?? null
          ),
          departmentName: r.department_name ?? null,
          degreeTitle: r.degree_title ?? null,
          sectionCode: r.section_code ?? null,
          eventPackageId: r.event_package_id ?? null,
          classType: classTypeFromEventPackage(r.event_package_id ?? null),
          latestStatus: r.status ?? null,
          latestInterventionAt: r.performed_at ?? null,
          teacherName: r.teacher_name ?? null,
          teacherPernr: r.teacher_pernr ?? null,
          teacherEmail: r.teacher_email ?? null,
        })),
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Intervention teacher search API error:", e);
    return NextResponse.json(
      { error: "Failed to load intervention courses for teacher search" },
      { status: 500 }
    );
  }
}
