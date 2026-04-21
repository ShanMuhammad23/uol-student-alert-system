import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { InterventionHistorySection } from "./_components/InterventionHistorySection";
import {
  getInterventionEmailsByStudentSapId,
  getInterventionsByStudentSapId,
} from "@/data/intervention-store";
import type { EnrollmentRecord } from "@/lib/enrollment";
import { StudentMetricsClient } from "./_components/StudentMetricsClient";
import { pool } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getStudentGpaProfileBySapId } from "@/lib/db/gpa";
import { getWellbeingCasesByStudentSapId } from "@/lib/db/wellbeing";
import { normalizeFacultyName, toShortFacultyName } from "@/lib/faculty-name";

type PropsType = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    from?: string;
    course?: string;
    section?: string;
    event_package?: string;
    class_avg?: string;
    /** `external` — wellbeing external direct case entry from dashboard (no course focus). */
    direct_case?: string;
  }>;
};

const FACULTY_ID_TO_ENROLLMENT_FAC_ID: Record<string, string> = {
  FAC_ENG: "50000172",
  FAC_MGT: "50000172",
};

function deriveClassTypeLabel(eventPackageId?: string | null): string {
  const raw = String(eventPackageId ?? "").trim();
  if (!raw) return "N/A";
  const lower = raw.toLowerCase();
  if (lower.includes("lect")) return "LECT";
  if (lower.includes("lab")) return "LAB";
  if (lower.includes("tut")) return "TUT";
  return raw;
}

type StudentProfileMetricRow = {
  courseId: string;
  courseTitle: string | null;
  sectionCode: string | null;
  instructorName: string | null;
  totalClassesHeld: number;
  attendanceMarkedClasses: number;
  classesAttended: number;
  attendancePercentage: number | null;
  classAverageAttendance: number | null;
  attendanceAlertLevel: "warning" | "critical" | null;
  gpaCurrent: number | null;
  gpaAlertLevel: "warning" | "critical" | null;
};

async function getEnrollmentForStudentSapId(
  sapId: string
): Promise<EnrollmentRecord[]> {
  if (!pool) return [];
  try {
    const res = await pool.query<{
      sap_id: string;
      student_name: string | null;
      department_id: string;
      department_name: string | null;
      department_code: string | null;
      faculty_id: string | null;
      program_id: string | null;
      program_title: string | null;
      course_id: string;
      course_title: string | null;
      section_code: string | null;
      instructor_name: string | null;
      instructor_pernr: string | null;
    }>(
      `SELECT
         e.sap_id,
         e.student_name,
         e.department_id,
         d.name AS department_name,
         d.code AS department_code,
         e.faculty_id,
         e.program_id,
         p.title AS program_title,
         e.course_id,
         c.title AS course_title,
         NULLIF(e.section_code, '') AS section_code,
         e.instructor_name,
         e.instructor_pernr
       FROM student_enrollment_current e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN programs p ON p.id = e.program_id
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE e.sap_id = $1
         AND e.is_active = TRUE
       ORDER BY e.course_id ASC, e.section_code ASC`,
      [sapId]
    );
    return res.rows.map((r) => ({
      SapNo: r.sap_id,
      Name: r.student_name ?? r.sap_id,
      DeptId: r.department_id,
      DeptCode: r.department_code ?? r.department_id,
      DeptName: r.department_name ?? r.department_id,
      FacId: r.faculty_id ?? undefined,
      DegreeCode: r.program_id ?? undefined,
      DegreeTitle: r.program_title ?? undefined,
      CrCode: r.course_id,
      CrTitle: r.course_title ?? r.course_id,
      Section: r.section_code ?? undefined,
      Teacher: r.instructor_name ?? undefined,
      Pernr: r.instructor_pernr ?? undefined,
      Id: `${r.sap_id}-${r.course_id}-${r.section_code ?? ""}`,
    }));
  } catch {
    return [];
  }
}

async function getStudentProfileMetricRows(
  sapId: string
): Promise<StudentProfileMetricRow[]> {
  if (!pool) return [];
  try {
    const res = await pool.query<{
      course_id: string;
      course_title: string | null;
      section_code: string | null;
      instructor_name: string | null;
      total_classes_held: number | null;
      attendance_marked_classes: number | null;
      classes_attended: number | null;
      attendance_percentage: number | null;
      class_average_attendance: number | null;
      attendance_alert_level: "warning" | "critical" | null;
      gpa_current: number | null;
      gpa_alert_level: "warning" | "critical" | null;
    }>(
      `SELECT
         e.course_id,
         c.title AS course_title,
         NULLIF(e.section_code, '') AS section_code,
         e.instructor_name,
         COALESCE(a.total_classes_held, 0) AS total_classes_held,
         COALESCE(a.attendance_marked_classes, 0) AS attendance_marked_classes,
         COALESCE(a.classes_attended, 0) AS classes_attended,
         a.attendance_percentage,
         a.class_average_attendance,
         a.attendance_alert_level,
         a.gpa_current,
         a.gpa_alert_level
       FROM student_enrollment_current e
       LEFT JOIN student_alert_current a
         ON a.sap_id = e.sap_id
        AND a.course_id = e.course_id
        AND a.section_code = e.section_code
        AND a.event_package_id = e.event_package_id
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE e.sap_id = $1
         AND e.is_active = TRUE
       ORDER BY e.course_id ASC, e.section_code ASC`,
      [sapId]
    );
    return res.rows.map((r) => ({
      courseId: r.course_id,
      courseTitle: r.course_title,
      sectionCode: r.section_code,
      instructorName: r.instructor_name,
      totalClassesHeld: Number(r.total_classes_held ?? 0),
      attendanceMarkedClasses: Number(r.attendance_marked_classes ?? 0),
      classesAttended: Number(r.classes_attended ?? 0),
      attendancePercentage:
        r.attendance_percentage == null ? null : Number(r.attendance_percentage),
      classAverageAttendance:
        r.class_average_attendance == null
          ? null
          : Number(r.class_average_attendance),
      attendanceAlertLevel: r.attendance_alert_level,
      gpaCurrent: r.gpa_current == null ? null : Number(r.gpa_current),
      gpaAlertLevel: r.gpa_alert_level,
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PropsType): Promise<Metadata> {
  const { id } = await params;
  const enrollment = await getEnrollmentForStudentSapId(id);
  const studentName = enrollment[0]?.Name?.trim();
  return {
    title: studentName ? `${studentName} | Student Profile` : `Student ${id} | Profile`,
  };
}

export default async function StudentPage({ params, searchParams }: PropsType) {
  const session = await getServerSession(authOptions);
  const currentUserRole = session?.user?.role ?? null;
  const currentUserPernr = session?.user?.pernr ?? null;
  const currentUserName = session?.user?.name ?? null;
  const currentUserEmail = session?.user?.email ?? null;
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const returnToUrl =
    resolvedSearchParams.from && resolvedSearchParams.from.startsWith("/")
      ? resolvedSearchParams.from
      : "/";
  const rawDirectCase = resolvedSearchParams.direct_case?.trim().toLowerCase();
  /** Wellbeing-initiated direct cases are always external; internal is for academic workflows elsewhere. */
  const directCaseMode = rawDirectCase === "external" ? ("external" as const) : null;
  const suppressCourseFocus = directCaseMode != null;
  const selectedCourseCode = suppressCourseFocus ? undefined : resolvedSearchParams.course;
  const selectedSection = suppressCourseFocus ? undefined : resolvedSearchParams.section;
  const selectedEventPackageId = suppressCourseFocus
    ? undefined
    : resolvedSearchParams.event_package;
  const classAverageParam = Number(resolvedSearchParams.class_avg);
  let selectedClassAverage =
    Number.isFinite(classAverageParam) && classAverageParam > 0
      ? classAverageParam
      : null;
  const sapIdFromUrl = id;
  const allowWellbeingDirectCaseEntry =
    directCaseMode != null &&
    (currentUserRole === "wellbeing" ||
      currentUserRole === "wellbeing-counseller" ||
      currentUserRole === "wellbeing-head" ||
      currentUserRole === "superadmin");

  if (
    (currentUserRole === "wellbeing" ||
      currentUserRole === "wellbeing-counseller") &&
    pool &&
    !allowWellbeingDirectCaseEntry
  ) {
    const access = await pool.query<{
      status: string | null;
      has_case: boolean;
      has_direct: boolean;
    }>(
      `WITH latest AS (
         SELECT status
         FROM interventions
         WHERE student_sap_id = $1
         ORDER BY performed_at DESC
         LIMIT 1
       )
       SELECT
         (SELECT status FROM latest) AS status,
         EXISTS (
           SELECT 1
           FROM wellbeing_cases wb
           WHERE wb.student_sap_id = $1
         ) AS has_case,
         EXISTS (
           SELECT 1 FROM wellbeing_direct_cases wdc
           WHERE wdc.student_sap_id = $1
         ) AS has_direct`,
      [sapIdFromUrl]
    );
    const row = access.rows[0];
    const isReferred = row?.status === "referred";
    const hasWellbeingCase = row?.has_case === true;
    const hasDirectCase = row?.has_direct === true;
    if (!isReferred && !hasWellbeingCase && !hasDirectCase) {
      notFound();
    }
  }
  const interventionHistory = await getInterventionsByStudentSapId(sapIdFromUrl);
  const wellbeingCases = await getWellbeingCasesByStudentSapId(sapIdFromUrl);
  const interventionEmails = await getInterventionEmailsByStudentSapId(sapIdFromUrl);
  const gpaProfile = await getStudentGpaProfileBySapId(sapIdFromUrl);

  const enrollmentRecords = await getEnrollmentForStudentSapId(sapIdFromUrl);
  const dbMetricRows = await getStudentProfileMetricRows(sapIdFromUrl);
  if (!enrollmentRecords.length) notFound();
  const primaryEnrollment = enrollmentRecords[0] ?? null;

  if (!selectedClassAverage && pool && !suppressCourseFocus) {
    try {
      const selectedCourse = selectedCourseCode
        ? enrollmentRecords.find((r) => String(r.CrCode ?? "").trim() === selectedCourseCode)
        : enrollmentRecords[0];
      if (selectedCourse?.CrCode) {
        const sectionCode = selectedSection ?? selectedCourse.Section ?? "";
        const eventPackageId = selectedEventPackageId ?? "";
        const alertRes = await pool.query<{ class_average_attendance: number | null }>(
          `SELECT class_average_attendance
           FROM student_alert_current
           WHERE sap_id = $1
             AND course_id = $2
             AND section_code = $3
             AND event_package_id = $4
           LIMIT 1`,
          [sapIdFromUrl, String(selectedCourse.CrCode), sectionCode, eventPackageId]
        );
        const avg = Number(alertRes.rows[0]?.class_average_attendance ?? NaN);
        if (Number.isFinite(avg) && avg > 0) {
          selectedClassAverage = avg;
        }
      }
    } catch {
      // Keep URL/default class average when lookup fails.
    }
  }

  let facultyName: string | null = null;
  const facultyId = primaryEnrollment?.FacId;
  if (facultyId && pool) {
    try {
      const mappedFacultyId =
        FACULTY_ID_TO_ENROLLMENT_FAC_ID[facultyId] ?? facultyId;
      const res = await pool.query<{ name: string }>(
        "SELECT name FROM faculties WHERE id = $1",
        [mappedFacultyId]
      );
      facultyName =
        normalizeFacultyName(res.rows[0]?.name?.trim() ?? null) ??
        normalizeFacultyName(mappedFacultyId) ??
        null;
    } catch {
      facultyName = null;
    }
  }
  if (facultyId && !facultyName) {
    const mappedFacultyId =
      FACULTY_ID_TO_ENROLLMENT_FAC_ID[facultyId] ?? facultyId;
    facultyName =
      normalizeFacultyName(facultyId) ??
      normalizeFacultyName(mappedFacultyId) ??
      `Faculty ${mappedFacultyId}`;
  }

  const attendanceForEmail =
    dbMetricRows.find((r) => r.attendancePercentage != null)?.attendancePercentage ?? null;
  const gpaPreviousForEmail = gpaProfile?.previous ?? null;
  const gpaCurrentForEmail = gpaProfile?.current ?? null;
  const gpaDropForEmail =
    typeof gpaProfile?.change === "number" && Number.isFinite(gpaProfile.change)
      ? gpaProfile.change
      : typeof gpaProfile?.previous === "number" &&
          Number.isFinite(gpaProfile.previous) &&
          typeof gpaProfile?.current === "number" &&
          Number.isFinite(gpaProfile.current)
        ? gpaProfile.previous - gpaProfile.current
        : null;
  const senderDesignation =
    currentUserRole === "superadmin"
      ? "Superadmin"
      : currentUserRole === "dean"
        ? "Dean"
        : currentUserRole === "hod"
          ? "Head of Department"
          : currentUserRole === "instructor"
            ? "Instructor"
              : currentUserRole === "wellbeing" ||
                  currentUserRole === "wellbeing-counseller" ||
                  currentUserRole === "wellbeing-head"
                ? "Wellbeing Officer"
            : null;
  const senderDepartmentName =
    primaryEnrollment?.DeptName?.replace("Department of", "").trim() ?? null;
  const senderFacultyName = toShortFacultyName(facultyName);
  const senderEmailForTemplate =
    process.env.SMTP_FROM ?? "alert@student-alert.uol.edu.pk";
  const focusedEnrollment =
    suppressCourseFocus || !selectedCourseCode
      ? null
      : enrollmentRecords.find((r) => String(r.CrCode ?? "").trim() === selectedCourseCode);
  const primaryEnrollmentForFocus = suppressCourseFocus ? null : enrollmentRecords[0] ?? null;
  const focusedCourseTitleForEmail = suppressCourseFocus
    ? "N/A"
    : (focusedEnrollment ?? primaryEnrollmentForFocus)
      ? `${String((focusedEnrollment ?? primaryEnrollmentForFocus)?.CrCode ?? "").trim()} - ${String(
          (focusedEnrollment ?? primaryEnrollmentForFocus)?.CrTitle ??
            (focusedEnrollment ?? primaryEnrollmentForFocus)?.CrCode ??
            "N/A"
        ).trim()}`
      : "N/A";
  const focusedClassTypeForEmail = suppressCourseFocus
    ? "N/A"
    : deriveClassTypeLabel(selectedEventPackageId ?? null);

  return (
    <div id="student-profile-pdf-content" className="w-full space-y-6 mt-4">
      {/* Back to list / Dashboard */}
      <div className="flex items-center gap-2">
        <Link
          href={returnToUrl}
          className="inline-flex items-center gap-2 text-lg font-medium text-primary hover:underline"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to list
        </Link>
      </div>

      {/* Profile Hero Card */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#1f4a3d] via-[#255a4a] to-[#1f4a3d] shadow-lg dark:bg-gray-dark">
        <div className="relative px-6 py-8 sm:px-8">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white blur-3xl" />
          </div>
          
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            
            <div className="flex-1 text-white">
              <h1 className="text-2xl font-bold sm:text-3xl">
                {primaryEnrollment?.Name ?? sapIdFromUrl} ({primaryEnrollment.Section})
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-white">
                <span className="flex  flex-col gap-1.5 border-r border-white/20 pr-4">
                  <span className="text-base">SAP ID:</span>
                  <span className="text-base font-medium">
                    {primaryEnrollment?.SapNo ?? sapIdFromUrl}
                  </span>
                </span>
                <span className="flex  flex-col gap-1.5 border-r border-white/20 pr-4">
                  <span className="text-base">Faculty:</span>
                  <span className="font-medium">
                    {toShortFacultyName(facultyName) ?? "—"}
                  </span>
                </span>
                <span className="flex  flex-col gap-1.5 border-r border-white/20 pr-4">
                  <span className="text-base">Department:</span>
                  <span className="font-medium">
                    {primaryEnrollment?.DeptName.replace("Department of", "") ?? "—"}
                  </span>
                </span>
                <span className="flex  flex-col gap-1.5 ">
                  <span className="text-base">Program:</span>
                  <span className="font-medium">
                    {primaryEnrollment?.DegreeTitle ??
                      primaryEnrollment?.DegreeCode ??
                      "—"}
                  </span>
                </span>
              </div>
            </div>
      <StudentMetricsClient
        sapId={sapIdFromUrl}
        section="badges"
        enrollmentRecords={enrollmentRecords}
        dbMetricRows={dbMetricRows}
        selectedCourseCode={selectedCourseCode}
        selectedSection={selectedSection}
        selectedClassAverage={selectedClassAverage}
        currentCgpa={gpaProfile?.current ?? null}
        gpaPrevious={gpaProfile?.previous ?? null}
        gpaChange={gpaProfile?.change ?? null}
        gpaTrendLevel={gpaProfile?.level ?? null}
        gpaTrendSeries={gpaProfile?.semesters ?? []}
        cgpaTrendSeries={gpaProfile?.cgpaSemesters ?? []}
        noFocusedCourse={suppressCourseFocus}
      />
          </div>
        </div>

    
      </div>

      <StudentMetricsClient
        sapId={sapIdFromUrl}
        section="analytics"
        enrollmentRecords={enrollmentRecords}
        dbMetricRows={dbMetricRows}
        selectedCourseCode={selectedCourseCode}
        selectedSection={selectedSection}
        currentCgpa={gpaProfile?.current ?? null}
        gpaPrevious={gpaProfile?.previous ?? null}
        gpaChange={gpaProfile?.change ?? null}
        gpaTrendLevel={gpaProfile?.level ?? null}
        gpaTrendSeries={gpaProfile?.semesters ?? []}
        cgpaTrendSeries={gpaProfile?.cgpaSemesters ?? []}
        selectedClassAverage={selectedClassAverage}
        noFocusedCourse={suppressCourseFocus}
      />

      {/* Intervention History (table + Add Intervention dialog) */}
      <InterventionHistorySection
        interventions={interventionHistory}
        wellbeingCases={wellbeingCases}
        sentEmails={interventionEmails}
        studentSapId={sapIdFromUrl}
        studentName={primaryEnrollment?.Name ?? sapIdFromUrl}
        attendancePercent={attendanceForEmail}
        gpaPrevious={gpaPreviousForEmail}
        gpaCurrent={gpaCurrentForEmail}
        gpaDrop={gpaDropForEmail}
        senderName={currentUserName}
        senderDesignation={senderDesignation}
        senderDepartment={senderDepartmentName}
        senderFaculty={senderFacultyName}
        senderEmail={senderEmailForTemplate}
        focusedCourseId={selectedCourseCode ?? null}
        focusedSectionCode={selectedSection ?? null}
        focusedEventPackageId={selectedEventPackageId ?? null}
        focusedCourseTitle={focusedCourseTitleForEmail}
        focusedClassType={focusedClassTypeForEmail}
        currentUserRole={currentUserRole}
        currentUserPernr={currentUserPernr}
        directCaseMode={directCaseMode}
      />

     
    </div>
  );
}