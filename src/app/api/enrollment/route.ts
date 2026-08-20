import { NextResponse } from "next/server";
import { enrolledInCurrentTermSql } from "@/lib/academic-term";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  try {
    if (!pool) {
      return NextResponse.json({ error: "Database is not configured" }, { status: 500 });
    }
    const res = await pool.query<{
      sap_id: string;
      student_name: string | null;
      faculty_id: string | null;
      department_id: string;
      department_code: string | null;
      department_name: string | null;
      program_id: string | null;
      program_title: string | null;
      course_id: string;
      course_title: string | null;
      section_code: string | null;
      instructor_name: string | null;
      instructor_pernr: string | null;
      instructor_email: string | null;
    }>(
      `SELECT
         e.sap_id,
         e.student_name,
         e.faculty_id,
         e.department_id,
         d.code AS department_code,
         d.name AS department_name,
         e.program_id,
         p.title AS program_title,
         e.course_id,
         c.title AS course_title,
         NULLIF(e.section_code, '') AS section_code,
         e.instructor_name,
         e.instructor_pernr,
         e.instructor_email
       FROM student_enrollment_current e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN programs p ON p.id = e.program_id
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE ${enrolledInCurrentTermSql("e")}`
    );
    return NextResponse.json(
      res.rows.map((r) => ({
        SapNo: r.sap_id,
        Name: r.student_name ?? r.sap_id,
        FacId: r.faculty_id ?? undefined,
        DeptId: r.department_id,
        DeptCode: r.department_code ?? r.department_id,
        DeptName: r.department_name ?? r.department_id,
        DegreeCode: r.program_id ?? undefined,
        DegreeTitle: r.program_title ?? undefined,
        CrCode: r.course_id,
        CrTitle: r.course_title ?? r.course_id,
        Section: r.section_code ?? undefined,
        Teacher: r.instructor_name ?? undefined,
        Pernr: r.instructor_pernr ?? undefined,
        Email: r.instructor_email ?? undefined,
      }))
    );
  } catch (err) {
    console.error("Enrollment API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load enrollment data" },
      { status: 500 }
    );
  }
}
