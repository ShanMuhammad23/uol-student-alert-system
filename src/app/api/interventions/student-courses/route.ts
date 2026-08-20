import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  currentOrIntervenedEnrollmentSql,
} from "@/lib/academic-term";
import { pool } from "@/lib/db";
import { subjectLinkedInterventionExistsSql } from "@/lib/db/interventions";

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
      intervention_type: "attendance" | "gpa" | "both" | null;
      status: string | null;
      performed_at: string | null;
      total_classes_held: number | null;
      attendance_marked_classes: number | null;
      classes_attended: number | null;
      attendance_percentage: number | null;
      class_average_attendance: number | null;
      attendance_alert_level: "warning" | "critical" | null;
      gpa_alert_level: "warning" | "critical" | null;
    }>(
      `WITH latest AS (
         SELECT DISTINCT ON (
           student_sap_id,
           COALESCE(course_id, ''),
            TRIM(COALESCE(section_code, '')),
            TRIM(COALESCE(event_package_id, ''))
         )
           student_sap_id,
           COALESCE(course_id, '') AS course_id,
           COALESCE(faculty_id, '') AS faculty_id,
           COALESCE(department_id, '') AS department_id,
           NULLIF(TRIM(COALESCE(section_code, '')), '') AS section_code,
           NULLIF(TRIM(COALESCE(event_package_id, '')), '') AS event_package_id,
           intervention_type,
           status,
           performed_at
         FROM interventions
         WHERE student_sap_id = $1
         ORDER BY
           student_sap_id,
           COALESCE(course_id, ''),
           TRIM(COALESCE(section_code, '')),
           TRIM(COALESCE(event_package_id, '')),
           performed_at DESC
       )
       SELECT
         ec.course_id,
         c.title AS course_title,
         COALESCE(NULLIF(TRIM(f.name), ''), ec.faculty_id) AS faculty_name,
         COALESCE(NULLIF(TRIM(d.name), ''), ec.department_id) AS department_name,
         COALESCE(NULLIF(TRIM(p.title), ''), ec.program_id) AS degree_title,
         NULLIF(TRIM(ec.section_code), '') AS section_code,
         NULLIF(TRIM(ec.event_package_id), '') AS event_package_id,
         l.intervention_type,
         l.status,
         l.performed_at::text,
         a.total_classes_held,
         a.attendance_marked_classes,
         a.classes_attended,
         a.attendance_percentage,
         a.class_average_attendance,
         a.attendance_alert_level,
         a.gpa_alert_level
       FROM student_enrollment_current ec
       LEFT JOIN latest l
         ON l.student_sap_id = ec.sap_id
        AND l.course_id = COALESCE(ec.course_id, '')
        AND COALESCE(TRIM(l.section_code), '') = COALESCE(TRIM(ec.section_code), '')
        AND COALESCE(TRIM(l.event_package_id), '') = COALESCE(TRIM(ec.event_package_id), '')
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
       WHERE ec.sap_id = $1
         AND ${currentOrIntervenedEnrollmentSql({
           alias: "ec",
           interventionExistsSql: subjectLinkedInterventionExistsSql({
             hasSectionCode: true,
             interventionAlias: "ix",
             enrollmentAlias: "ec",
           }),
         })}
         AND (
           l.status IS NOT NULL
           OR a.attendance_alert_level IS NOT NULL
           OR a.gpa_alert_level IS NOT NULL
         )
       ORDER BY ec.course_id ASC, ec.section_code ASC, ec.event_package_id ASC`,
      [sapId]
    );

    return NextResponse.json(
      {
        rows: res.rows.map((r) => ({
          alertType:
            r.attendance_alert_level && r.gpa_alert_level
              ? "both"
              : r.attendance_alert_level
              ? "attendance"
              : r.gpa_alert_level
              ? "gpa"
              : r.intervention_type ?? null,
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
    console.error("Intervention student search API error:", e);
    return NextResponse.json(
      { error: "Failed to load intervention courses for student" },
      { status: 500 }
    );
  }
}
