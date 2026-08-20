import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { enrolledInCurrentTermSql } from "@/lib/academic-term";
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
      sap_id: string;
      student_name: string | null;
      course_id: string;
      course_title: string | null;
      faculty_name: string | null;
      department_name: string | null;
      degree_title: string | null;
      section_code: string | null;
      event_package_id: string | null;
      intervention_type: "attendance" | "gpa" | "both" | null;
      status: string | null;
      performed_at: string | null;
      teacher_name: string | null;
      teacher_pernr: string | null;
      teacher_email: string | null;
      faculty_id: string | null;
      total_classes_held: number | null;
      attendance_marked_classes: number | null;
      classes_attended: number | null;
      attendance_percentage: number | null;
      class_average_attendance: number | null;
      attendance_alert_level: "warning" | "critical" | null;
      gpa_alert_level: "warning" | "critical" | null;
    }>(
      `WITH matched_staff AS (
         SELECT id::text AS staff_id, name, pernr, email
         FROM staff
         WHERE
           LOWER(COALESCE(name, '')) LIKE LOWER($1)
           OR LOWER(COALESCE(pernr, '')) LIKE LOWER($1)
       ),
       matched_instructors AS (
         SELECT DISTINCT
           COALESCE(NULLIF(TRIM(ms.pernr), ''), '') AS pernr,
           NULLIF(TRIM(ms.name), '') AS name,
           NULLIF(TRIM(ms.email), '') AS email
         FROM matched_staff ms
         UNION
         SELECT DISTINCT
           COALESCE(NULLIF(TRIM(ec.instructor_pernr), ''), '') AS pernr,
           NULLIF(TRIM(ec.instructor_name), '') AS name,
           NULL::text AS email
         FROM student_enrollment_current ec
         WHERE ${enrolledInCurrentTermSql("ec")}
           AND (
             LOWER(COALESCE(ec.instructor_name, '')) LIKE LOWER($1)
             OR LOWER(COALESCE(ec.instructor_pernr, '')) LIKE LOWER($1)
           )
       ),
       latest_by_teacher AS (
         SELECT DISTINCT ON (
           student_sap_id,
           COALESCE(NULLIF(TRIM(course_id), ''), ''),
           COALESCE(NULLIF(TRIM(section_code), ''), ''),
           COALESCE(NULLIF(TRIM(event_package_id), ''), '')
         )
           student_sap_id,
           COALESCE(NULLIF(TRIM(course_id), ''), '') AS course_id,
           NULLIF(TRIM(section_code), '') AS section_code,
           NULLIF(TRIM(event_package_id), '') AS event_package_id,
           intervention_type,
           status,
           performed_at
         FROM interventions i
         INNER JOIN matched_staff ms
           ON ms.staff_id = i.staff_id::text
         ORDER BY
           student_sap_id,
           COALESCE(NULLIF(TRIM(course_id), ''), ''),
           COALESCE(NULLIF(TRIM(section_code), ''), ''),
           COALESCE(NULLIF(TRIM(event_package_id), ''), ''),
           performed_at DESC
       )
       SELECT
         ec.sap_id,
         ec.student_name,
         ec.course_id,
         c.title AS course_title,
         ec.faculty_id,
         COALESCE(NULLIF(TRIM(f.name), ''), ec.faculty_id) AS faculty_name,
         COALESCE(NULLIF(TRIM(d.name), ''), ec.department_id) AS department_name,
         COALESCE(NULLIF(TRIM(p.title), ''), ec.program_id) AS degree_title,
         NULLIF(TRIM(ec.section_code), '') AS section_code,
         NULLIF(TRIM(ec.event_package_id), '') AS event_package_id,
         lbt.intervention_type,
         lbt.status,
         lbt.performed_at::text,
         COALESCE(mi.name, ec.instructor_name) AS teacher_name,
         COALESCE(NULLIF(TRIM(ec.instructor_pernr), ''), mi.pernr) AS teacher_pernr,
         mi.email AS teacher_email,
         a.total_classes_held,
         a.attendance_marked_classes,
         a.classes_attended,
         a.attendance_percentage,
         a.class_average_attendance,
         a.attendance_alert_level,
         a.gpa_alert_level
       FROM student_enrollment_current ec
       INNER JOIN matched_instructors mi
         ON COALESCE(NULLIF(TRIM(ec.instructor_pernr), ''), '') = mi.pernr
       LEFT JOIN latest_by_teacher lbt
         ON lbt.student_sap_id = ec.sap_id
        AND lbt.course_id = COALESCE(ec.course_id, '')
        AND COALESCE(TRIM(lbt.section_code), '') = COALESCE(TRIM(ec.section_code), '')
        AND COALESCE(TRIM(lbt.event_package_id), '') = COALESCE(TRIM(ec.event_package_id), '')
       LEFT JOIN courses c ON c.id = ec.course_id
       LEFT JOIN faculties f
         ON f.id = ec.faculty_id
       LEFT JOIN departments d
         ON d.id = ec.department_id
       LEFT JOIN programs p
         ON p.id = ec.program_id
       LEFT JOIN student_alert_current a
         ON a.sap_id = ec.sap_id
        AND a.course_id = ec.course_id
        AND COALESCE(TRIM(a.section_code), '') = COALESCE(TRIM(ec.section_code), '')
        AND COALESCE(TRIM(a.event_package_id), '') = COALESCE(TRIM(ec.event_package_id), '')
       WHERE ${enrolledInCurrentTermSql("ec")}
         AND (
           lbt.status IS NOT NULL
           OR (
             (a.attendance_alert_level IS NOT NULL OR a.gpa_alert_level IS NOT NULL)
             AND lbt.status IS NULL
           )
         )
       ORDER BY
         ec.sap_id,
         ec.course_id,
         COALESCE(TRIM(ec.section_code), ''),
         COALESCE(TRIM(ec.event_package_id), ''),
         lbt.performed_at DESC`,
      [`%${query}%`]
    );

    return NextResponse.json(
      {
        rows: res.rows.map((r) => ({
          sapId: r.sap_id,
          studentName: r.student_name ?? r.sap_id,
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
          alertType:
            r.attendance_alert_level && r.gpa_alert_level
              ? "both"
              : r.attendance_alert_level
              ? "attendance"
              : r.gpa_alert_level
              ? "gpa"
              : r.intervention_type ?? null,
          latestStatus: r.status ?? null,
          latestInterventionAt: r.performed_at ?? null,
          teacherName: r.teacher_name ?? null,
          teacherPernr: r.teacher_pernr ?? null,
          teacherEmail: r.teacher_email ?? null,
          totalClassesHeld: Number(r.total_classes_held ?? 0),
          attendanceMarkedClasses: Number(r.attendance_marked_classes ?? 0),
          classesAttended: Number(r.classes_attended ?? 0),
          attendancePercentage:
            r.attendance_percentage == null ? null : Number(r.attendance_percentage),
          classAverageAttendance:
            r.class_average_attendance == null
              ? null
              : Number(r.class_average_attendance),
          attendanceAlertLevel: r.attendance_alert_level ?? null,
          gpaAlertLevel: r.gpa_alert_level ?? null,
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
