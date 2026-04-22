import { pool } from "@/lib/db";
import { hasAssigneeStaffIdColumn, hasCaseTypeColumn } from "@/lib/db/interventions";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";

export type WellbeingHeadCaseListItem = {
  interventionId: string;
  studentSapId: string;
  studentName: string;
  facultyName: string | null;
  departmentName: string | null;
  programTitle: string | null;
  attendancePercentage: number | null;
  attendanceMarkedClasses: number | null;
  classesAttended: number | null;
  gpaCurrent: number | null;
  status: string;
  caseType: "referred" | "internal" | "external" | null;
  assigneeStaffId: string | null;
  assigneeName: string | null;
  assigneePernr: string | null;
  performedAt: string;
};

export type WellbeingHeadCaseListings = {
  referredCases: WellbeingHeadCaseListItem[];
  directCases: WellbeingHeadCaseListItem[];
};

export type WellbeingAssigneeOption = {
  id: string;
  name: string;
  pernr: string | null;
};

function normalizeStatus(input: string | null | undefined): string {
  return String(input ?? "").trim().toLowerCase() === "resolved" ? "resolved" : "open";
}

export async function getWellbeingHeadCaseListings(): Promise<WellbeingHeadCaseListings> {
  if (!pool) {
    return { referredCases: [], directCases: [] };
  }

  const hasCaseType = await hasCaseTypeColumn();
  const caseTypeExpr = hasCaseType ? "i.case_type" : "'referred'::varchar";
  const hasAssignee = await hasAssigneeStaffIdColumn();
  const assigneeIdExpr = hasAssignee ? "i.assignee_staff_id::text" : "NULL::text";
  const assigneeJoin = hasAssignee ? "LEFT JOIN staff sa ON sa.id = i.assignee_staff_id" : "";
  const assigneeNameExpr = hasAssignee ? "sa.name" : "NULL::varchar";
  const assigneePernrExpr = hasAssignee ? "sa.pernr" : "NULL::varchar";

  const res = await pool.query<{
    intervention_id: string;
    student_sap_id: string;
    student_name: string | null;
    faculty_id: string | null;
    faculty_name: string | null;
    department_name: string | null;
    program_title: string | null;
    attendance_percentage: number | null;
    attendance_marked_classes: number | null;
    classes_attended: number | null;
    gpa_current: number | null;
    status: string | null;
    case_type: "referred" | "internal" | "external" | null;
    assignee_staff_id: string | null;
    assignee_name: string | null;
    assignee_pernr: string | null;
    performed_at: string;
  }>(
    `
      SELECT DISTINCT ON (i.student_sap_id)
        i.id::text AS intervention_id,
        i.student_sap_id,
        s.full_name AS student_name,
        e.faculty_id::text AS faculty_id,
        f.name AS faculty_name,
        d.name AS department_name,
        p.title AS program_title,
        a.attendance_percentage,
        a.attendance_marked_classes,
        a.classes_attended,
        a.gpa_current,
        i.status,
        ${caseTypeExpr} AS case_type,
        ${assigneeIdExpr} AS assignee_staff_id,
        ${assigneeNameExpr} AS assignee_name,
        ${assigneePernrExpr} AS assignee_pernr,
        i.performed_at::text
      FROM interventions i
      LEFT JOIN students s ON s.sap_id = i.student_sap_id
      LEFT JOIN student_enrollment_current e
        ON e.sap_id = i.student_sap_id
       AND COALESCE(e.is_active, TRUE) = TRUE
      LEFT JOIN faculties f ON f.id = e.faculty_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN programs p ON p.id = e.program_id
      LEFT JOIN student_alert_current a
        ON a.sap_id = e.sap_id
       AND a.course_id = e.course_id
       AND COALESCE(a.section_code, '') = COALESCE(e.section_code, '')
       AND COALESCE(a.event_package_id, '') = COALESCE(e.event_package_id, '')
      ${assigneeJoin}
      ORDER BY i.student_sap_id, COALESCE(e.updated_at, e.created_at) DESC NULLS LAST, i.performed_at DESC, i.id DESC
    `
  );

  const mapped: WellbeingHeadCaseListItem[] = res.rows.map((row) => ({
    interventionId: row.intervention_id,
    studentSapId: row.student_sap_id,
    studentName: String(row.student_name ?? "").trim() || "Unknown Student",
    facultyName: resolveFacultyNameFromIdOrName(row.faculty_id, row.faculty_name),
    departmentName: row.department_name,
    programTitle: row.program_title,
    attendancePercentage: row.attendance_percentage,
    attendanceMarkedClasses: row.attendance_marked_classes,
    classesAttended: row.classes_attended,
    gpaCurrent: row.gpa_current,
    status: normalizeStatus(row.status),
    caseType: row.case_type,
    assigneeStaffId: row.assignee_staff_id,
    assigneeName: row.assignee_name,
    assigneePernr: row.assignee_pernr,
    performedAt: row.performed_at,
  }));

  return {
    referredCases: mapped.filter((row) => row.caseType === "referred" || row.caseType === null),
    directCases: mapped.filter((row) => row.caseType === "internal" || row.caseType === "external"),
  };
}

export async function getWellbeingAssignableStaff(): Promise<WellbeingAssigneeOption[]> {
  if (!pool) return [];
  const res = await pool.query<{ id: string; name: string; pernr: string | null }>(
    `SELECT id::text, name, pernr
     FROM staff
     WHERE role IN ('wellbeing', 'wellbeing-head', 'wellbeing-counseller')
     ORDER BY name ASC`
  );
  return res.rows.map((row) => ({ id: row.id, name: row.name, pernr: row.pernr }));
}

export async function assignWellbeingCaseIntervention(
  interventionId: string,
  assigneeStaffId: string
): Promise<boolean> {
  if (!pool) return false;
  const hasAssignee = await hasAssigneeStaffIdColumn();
  if (!hasAssignee) return false;
  const res = await pool.query(
    `UPDATE interventions
     SET assignee_staff_id = $2::uuid
     WHERE id = $1`,
    [interventionId, assigneeStaffId]
  );
  return (res.rowCount ?? 0) > 0;
}
