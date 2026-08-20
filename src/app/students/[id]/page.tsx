import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertHistoryStepper } from "./_components/AlertHistoryStepper";
import { InterventionHistorySection } from "./_components/InterventionHistorySection";
import {
  getInterventionEmailsByStudentSapId,
  getInterventionsByStudentSapId,
} from "@/data/intervention-store";
import type { EnrollmentRecord } from "@/lib/enrollment";
import { StudentMetricsClient } from "./_components/StudentMetricsClient";
import { pool } from "@/lib/db";
import {
  cheapSubjectInterventionExistsSql,
  currentOrIntervenedEnrollmentSql,
  formatAcademicTermLabel,
  getCurrentAcademicTerm,
  isCurrentAcademicTerm,
  isDateInCurrentTerm,
} from "@/lib/academic-term";
import { getWellbeingCounsellorEmailOptions } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getStudentGpaProfileBySapId } from "@/lib/db/gpa";
import { getStudentAlertDailyHistory } from "@/lib/db/student-alert-history";
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

function formatAdmissionLabel(
  admissionSession: string | null | undefined,
  admissionYear: string | null | undefined
): string | null {
  const session = String(admissionSession ?? "").trim().toLowerCase();
  const year = String(admissionYear ?? "").trim();
  if (!session || !year) return null;
  const sessionLabel =
    session === "spring" || session === "summer" || session === "fall"
      ? `${session.charAt(0).toUpperCase()}${session.slice(1)}`
      : session.charAt(0).toUpperCase() + session.slice(1);
  return `${sessionLabel} ${year}`;
}

type StudentProfileMetricRow = {
  courseId: string;
  courseTitle: string | null;
  sectionCode: string | null;
  eventPackageId: string | null;
  instructorName: string | null;
  totalClassesHeld: number;
  attendanceMarkedClasses: number;
  classesAttended: number;
  attendancePercentage: number | null;
  classAverageAttendance: number | null;
  attendanceAlertLevel: "warning" | "critical" | null;
  gpaCurrent: number | null;
  gpaAlertLevel: "warning" | "critical" | null;
  termYear: string | null;
  termSession: string | null;
  termLabel: string | null;
  isActive: boolean;
  isCurrentTerm: boolean;
};

const PROFILE_ENROLLMENT_VISIBILITY_SQL = currentOrIntervenedEnrollmentSql({
  alias: "e",
  interventionExistsSql: cheapSubjectInterventionExistsSql({
    interventionAlias: "ix",
    enrollmentAlias: "e",
  }),
});

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
      admission_year: string | null;
      admission_session: string | null;
      course_id: string;
      course_title: string | null;
      section_code: string | null;
      instructor_name: string | null;
      instructor_pernr: string | null;
      term_year: string | null;
      term_session: string | null;
      is_active: boolean | null;
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
         e.admission_year,
         e.admission_session,
         e.course_id,
         c.title AS course_title,
         NULLIF(e.section_code, '') AS section_code,
         e.instructor_name,
         e.instructor_pernr,
         NULLIF(TRIM(e.term_year), '') AS term_year,
         NULLIF(TRIM(e.term_session), '') AS term_session,
         e.is_active
       FROM student_enrollment_current e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN programs p ON p.id = e.program_id
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE e.sap_id = $1
         AND ${PROFILE_ENROLLMENT_VISIBILITY_SQL}
       ORDER BY e.is_active DESC NULLS LAST, e.course_id ASC, e.section_code ASC`,
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
      AdmAyear: r.admission_year ?? undefined,
      AdmSession: r.admission_session ?? undefined,
      CrCode: r.course_id,
      CrTitle: r.course_title ?? r.course_id,
      Section: r.section_code ?? undefined,
      Teacher: r.instructor_name ?? undefined,
      Pernr: r.instructor_pernr ?? undefined,
      Peryr: r.term_year ?? undefined,
      Perid: r.term_session ?? undefined,
      IsActive: r.is_active === true,
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
      event_package_id: string | null;
      instructor_name: string | null;
      total_classes_held: number | null;
      attendance_marked_classes: number | null;
      classes_attended: number | null;
      attendance_percentage: number | null;
      class_average_attendance: number | null;
      attendance_alert_level: "warning" | "critical" | null;
      gpa_current: number | null;
      gpa_alert_level: "warning" | "critical" | null;
      term_year: string | null;
      term_session: string | null;
      is_active: boolean | null;
    }>(
      `SELECT
         e.course_id,
         c.title AS course_title,
         NULLIF(e.section_code, '') AS section_code,
         NULLIF(e.event_package_id, '') AS event_package_id,
         e.instructor_name,
         COALESCE(a.total_classes_held, 0) AS total_classes_held,
         COALESCE(a.attendance_marked_classes, 0) AS attendance_marked_classes,
         COALESCE(a.classes_attended, 0) AS classes_attended,
         a.attendance_percentage,
         a.class_average_attendance,
         a.attendance_alert_level,
         a.gpa_current,
         a.gpa_alert_level,
         NULLIF(TRIM(e.term_year), '') AS term_year,
         NULLIF(TRIM(e.term_session), '') AS term_session,
         e.is_active
       FROM student_enrollment_current e
       LEFT JOIN student_alert_current a
         ON a.sap_id = e.sap_id
        AND a.course_id = e.course_id
        AND a.section_code = e.section_code
        AND a.event_package_id = e.event_package_id
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE e.sap_id = $1
         AND ${PROFILE_ENROLLMENT_VISIBILITY_SQL}
       ORDER BY e.is_active DESC NULLS LAST, e.course_id ASC, e.section_code ASC`,
      [sapId]
    );
    return res.rows.map((r) => ({
      courseId: r.course_id,
      courseTitle: r.course_title,
      sectionCode: r.section_code,
      eventPackageId: r.event_package_id,
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
      termYear: r.term_year,
      termSession: r.term_session,
      termLabel: formatAcademicTermLabel(r.term_year, r.term_session),
      isActive: r.is_active === true,
      isCurrentTerm: isCurrentAcademicTerm(r.term_year, r.term_session),
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PropsType): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Student ${id} | Profile`,
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
  const selectedClassAverageFromUrl =
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
  const alertHistoryCourseId = suppressCourseFocus ? null : selectedCourseCode ?? null;
  const alertHistorySectionCode = suppressCourseFocus ? null : selectedSection ?? null;
  const alertHistoryEventPackageId = suppressCourseFocus
    ? null
    : selectedEventPackageId ?? null;

  const [
    interventionHistory,
    wellbeingCases,
    interventionEmails,
    wellbeingCounsellorEmailOptions,
    gpaProfile,
    enrollmentRecords,
    dbMetricRows,
    alertDailyHistory,
  ] = await Promise.all([
    getInterventionsByStudentSapId(sapIdFromUrl),
    getWellbeingCasesByStudentSapId(sapIdFromUrl),
    getInterventionEmailsByStudentSapId(sapIdFromUrl),
    getWellbeingCounsellorEmailOptions(),
    getStudentGpaProfileBySapId(sapIdFromUrl),
    getEnrollmentForStudentSapId(sapIdFromUrl),
    getStudentProfileMetricRows(sapIdFromUrl),
    getStudentAlertDailyHistory(sapIdFromUrl, {
      courseId: alertHistoryCourseId,
      sectionCode: alertHistorySectionCode,
      eventPackageId: alertHistoryEventPackageId,
    }),
  ]);
  if (!enrollmentRecords.length) notFound();
  const currentlyEnrolled = dbMetricRows.some((row) => row.isActive && row.isCurrentTerm);
  const currentTerm = getCurrentAcademicTerm();
  const currentTermLabel = formatAcademicTermLabel(
    currentTerm.termYear,
    currentTerm.termSession
  );
  const hasSgpaInterventionThisTerm = interventionHistory.some(
    (row) =>
      (row.intervention_type === "gpa" || row.intervention_type === "both") &&
      (isDateInCurrentTerm(row.date) || isDateInCurrentTerm(row.performed_at))
  );
  const primaryEnrollment = enrollmentRecords[0] ?? null;
  const admissionLabel = formatAdmissionLabel(
    String(primaryEnrollment?.AdmSession ?? ""),
    String(primaryEnrollment?.AdmAyear ?? "")
  );

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

  const focusedMetricRow = suppressCourseFocus
    ? null
    : dbMetricRows.find((r) => {
        const courseMatch =
          !selectedCourseCode ||
          String(r.courseId ?? "").trim() === String(selectedCourseCode).trim();
        const sectionMatch =
          !selectedSection ||
          String(r.sectionCode ?? "").trim() === String(selectedSection).trim();
        const packageMatch =
          !selectedEventPackageId ||
          String(r.eventPackageId ?? "").trim() === String(selectedEventPackageId).trim();
        return courseMatch && sectionMatch && packageMatch;
      }) ??
      dbMetricRows.find((r) => {
        const courseMatch =
          !selectedCourseCode ||
          String(r.courseId ?? "").trim() === String(selectedCourseCode).trim();
        const sectionMatch =
          !selectedSection ||
          String(r.sectionCode ?? "").trim() === String(selectedSection).trim();
        return courseMatch && sectionMatch;
      }) ??
      null;
  const selectedClassAverage =
    selectedClassAverageFromUrl ??
    focusedMetricRow?.classAverageAttendance ??
    (suppressCourseFocus
      ? dbMetricRows.find((r) => r.classAverageAttendance != null)
          ?.classAverageAttendance ?? null
      : null);
  const attendanceForEmail =
    focusedMetricRow?.attendancePercentage ??
    (suppressCourseFocus
      ? dbMetricRows.find((r) => r.attendancePercentage != null)?.attendancePercentage ?? null
      : null);
  const attendanceAlertLevelForEmail =
    focusedMetricRow?.attendanceAlertLevel ??
    (suppressCourseFocus
      ? dbMetricRows.find((r) => r.attendanceAlertLevel != null)?.attendanceAlertLevel ?? null
      : null);
  const orderedSgpaSeries = [...(gpaProfile?.semesters ?? [])];
  const latestSeriesGpa = orderedSgpaSeries.at(-1)?.value ?? null;
  const previousSeriesGpa =
    orderedSgpaSeries.length >= 2
      ? orderedSgpaSeries[orderedSgpaSeries.length - 2]?.value ?? null
      : null;
  const gpaCurrentForEmail =
    gpaProfile?.current ??
    latestSeriesGpa ??
    dbMetricRows.find((r) => r.gpaCurrent != null)?.gpaCurrent ??
    null;
  const gpaPreviousForEmail = gpaProfile?.previous ?? previousSeriesGpa ?? null;
  const gpaDropForEmail =
    typeof gpaProfile?.change === "number" && Number.isFinite(gpaProfile.change)
      ? gpaProfile.change
      : typeof gpaProfile?.previous === "number" &&
          Number.isFinite(gpaProfile.previous) &&
          typeof gpaProfile?.current === "number" &&
          Number.isFinite(gpaProfile.current)
        ? gpaProfile.previous - gpaProfile.current
        : null;
  const orderedCgpaSeries = [...(gpaProfile?.cgpaSemesters ?? [])];
  const cgpaCurrentForEmail = orderedCgpaSeries.at(-1)?.value ?? null;
  const cgpaPreviousForEmail =
    orderedCgpaSeries.length >= 2
      ? orderedCgpaSeries[orderedCgpaSeries.length - 2]?.value ?? null
      : null;
  const cgpaDropForEmail =
    typeof cgpaCurrentForEmail === "number" &&
    Number.isFinite(cgpaCurrentForEmail) &&
    typeof cgpaPreviousForEmail === "number" &&
    Number.isFinite(cgpaPreviousForEmail)
      ? cgpaPreviousForEmail - cgpaCurrentForEmail
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
    session?.user?.email?.trim() ||
    process.env.SMTP_FROM ||
    "alert@student-alert.uol.edu.pk";
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
              <div className="flex  gap-2">
              <h1 className="text-2xl font-bold sm:text-3xl">
                {primaryEnrollment?.Name ?? sapIdFromUrl} ({primaryEnrollment.Section})
              </h1>
              {!currentlyEnrolled ? (
                <p className="p-2 ml-4 bg-amber-100 text-amber-800 rounded-md">
                  Not enrolled in {currentTermLabel ?? "the current semester"}. Showing
                  subject(s) with an intervention
                  {focusedMetricRow?.termLabel || dbMetricRows[0]?.termLabel
                    ? ` from ${focusedMetricRow?.termLabel ?? dbMetricRows[0]?.termLabel}`
                    : ""}
                  .
                </p>
              ) : null}
              </div>
             
              
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
                <span className="flex flex-col gap-1.5 border-l border-white/20 pl-4">
                  <span className="text-base">Admission:</span>
                  <span className="font-medium">{admissionLabel ?? "—"}</span>
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
        currentlyEnrolled={currentlyEnrolled}
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
        currentlyEnrolled={currentlyEnrolled}
      />

      {/* Intervention History (table + Add Intervention dialog) */}
      <InterventionHistorySection
        interventions={interventionHistory}
        wellbeingCases={wellbeingCases}
        sentEmails={interventionEmails}
        studentSapId={sapIdFromUrl}
        studentName={primaryEnrollment?.Name ?? sapIdFromUrl}
        attendancePercent={attendanceForEmail}
        attendanceAlertLevel={attendanceAlertLevelForEmail}
        gpaPrevious={gpaPreviousForEmail}
        gpaCurrent={gpaCurrentForEmail}
        gpaDrop={gpaDropForEmail}
        cgpaPrevious={cgpaPreviousForEmail}
        cgpaCurrent={cgpaCurrentForEmail}
        cgpaDrop={cgpaDropForEmail}
        senderName={currentUserName}
        senderDesignation={senderDesignation}
        senderDepartment={senderDepartmentName}
        senderFaculty={senderFacultyName}
        senderEmail={senderEmailForTemplate}
        wellbeingCounsellorEmailOptions={wellbeingCounsellorEmailOptions}
        focusedCourseId={selectedCourseCode ?? null}
        focusedSectionCode={selectedSection ?? null}
        focusedEventPackageId={selectedEventPackageId ?? null}
        focusedCourseTitle={focusedCourseTitleForEmail}
        focusedClassType={focusedClassTypeForEmail}
        currentUserRole={currentUserRole}
        currentUserPernr={currentUserPernr}
        directCaseMode={directCaseMode}
        sgpaAlreadyRecordedThisTerm={hasSgpaInterventionThisTerm}
        currentTermLabel={currentTermLabel}
      />

     
    </div>
  );
}