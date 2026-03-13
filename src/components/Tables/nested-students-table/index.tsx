import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getStudentsByAlert, getFullData } from "@/app/(home)/dashboard/fetch";
import { fetchMonitoringEntries } from "@/lib/sap-monitoring";
import type {
  AppUser,
  Student,
  Department,
  Course,
  MasterFilterParams,
  AlertDimensionFilter,
} from "@/app/(home)/dashboard/fetch";
import { StudentActionDropdown } from "@/app/(home)/dashboard/_components/student-action-dropdown";
import { getLatestInterventionStatusMap } from "@/data/intervention-store";
import { InterventionStatusBadge } from "@/app/(home)/dashboard/_components/intervention-status-badge";
import { StudentProfileLink } from "./StudentProfileLink";
import { SortableTableHead, type SortKey, type SortOrder } from "./SortableTableHead";
import { ClearSortButton } from "./ClearSortButton";

export { TopChannelsTableClient } from "./TopChannelsTableClient";

/** One enrollment record from public/enrollment_data.json */
export type EnrollmentRecord = {
  Name: string;
  SapNo: string;
  DeptName: string;
  DeptCode?: string;
  DegreeTitle: string;
  DegreeCode?: string;
  CrTitle: string;
  CrCode: string;
  Teacher: string | null;
  Id?: string;
  [key: string]: unknown;
};

type PropsType = {
  className?: string;
  returnToUrl?: string;
  expandedIds?: string[];
  selectedAlert?: string;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
  interventionFilters?: string[];
  sortBy?: SortKey | null;
  sortOrder?: SortOrder;
};

function sortStudents(
  students: Student[],
  sortBy: SortKey | null | undefined,
  sortOrder: SortOrder
): Student[] {
  if (!sortBy) return students;
  const copy = [...students];
  const mult = sortOrder === "asc" ? 1 : -1;
  if (sortBy === "attendance") {
    copy.sort(
      (a, b) =>
        mult *
        (a.attendance.attendance_percentage - b.attendance.attendance_percentage)
    );
  } else {
    copy.sort((a, b) => mult * (a.gpa.current - b.gpa.current));
  }
  return copy;
}

function applyInterventionFilters(
  students: Student[],
  interventionFilters: string[] | undefined,
  statusMap: Map<string, string | null>,
): Student[] {
  if (!interventionFilters || interventionFilters.length === 0) {
    return students;
  }

  return students.filter((student) => {
    const isGoodStudent =
      student.gpa.alert_level == null &&
      student.attendance.alert_level == null;
    if (isGoodStudent) return false;

    const latestStatus = statusMap.get(student.sap_id) ?? null;

    const wantsNotStarted = interventionFilters.includes("not_started");
    const wantsInitiated = interventionFilters.includes("initiated");
    const wantsInProgress = interventionFilters.includes("in_progress");
    const wantsReferred = interventionFilters.includes("referred");
    const wantsResolved = interventionFilters.includes("resolved");

    if (!latestStatus) {
      return wantsNotStarted;
    }

    if (wantsInitiated && latestStatus === "initiated") return true;
    if (wantsInProgress && latestStatus === "in-progress") return true;
    if (wantsReferred && latestStatus === "referred") return true;
    if (wantsResolved && latestStatus === "resolved") return true;

    return false;
  });
}

// Helper function to extract program prefix from course ID (e.g., "CS101" -> "CS")
function getProgramFromCourse(courseId: string): string {
  // Extract alphabetic prefix from course ID
  const match = courseId.match(/^([A-Z]+)/);
  return match ? match[1] : courseId.substring(0, 2);
}

// Yellow (warning) vs red (critical) counts for overview-style display
function getAlertCounts(students: Student[]) {
  let gpaYellow = 0,
    gpaRed = 0,
    attYellow = 0,
    attRed = 0;
  for (const s of students) {
    if (s.gpa.alert_level === "warning") gpaYellow += 1;
    if (s.gpa.alert_level === "critical") gpaRed += 1;
    if (s.attendance.alert_level === "warning") attYellow += 1;
    if (s.attendance.alert_level === "critical") attRed += 1;
  }
  return { gpaYellow, gpaRed, attYellow, attRed };
}

// Group students by department -> program -> course
function groupStudentsForDean(
  students: Student[],
  departments: Department[],
  courses: Course[]
): Record<string, Record<string, Record<string, Student[]>>> {
  const result: Record<string, Record<string, Record<string, Student[]>>> = {};

  for (const student of students) {
    const deptId = student.department_id;
    const courseId = student.course_id;
    const programId = getProgramFromCourse(courseId);

    if (!result[deptId]) {
      result[deptId] = {};
    }
    if (!result[deptId][programId]) {
      result[deptId][programId] = {};
    }
    if (!result[deptId][programId][courseId]) {
      result[deptId][programId][courseId] = [];
    }
    result[deptId][programId][courseId].push(student);
  }

  return result;
}

/** Fetch enrollment data from public/enrollment_data.json */
async function fetchEnrollmentData(): Promise<EnrollmentRecord[]> {
  if (typeof window === "undefined") {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "enrollment_data.json");
    const content = await fs.readFile(filePath, "utf-8");
    const raw = JSON.parse(content) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw as EnrollmentRecord[];
  }
  const res = await fetch("/enrollment_data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load enrollment_data.json");
  const raw = (await res.json()) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw as EnrollmentRecord[];
}

export async function TopChannelsTableView({
  className,
  returnToUrl = "/",
  selectedAlert = "all",
  user,
  masterFilter,
  gpaFilters,
  attendanceFilters,
  interventionFilters = [],
  sortBy = null,
  sortOrder = "asc",
}: PropsType) {
  const enrollments = await fetchEnrollmentData();

  // Total student count = number of objects (enrollment records) per course (CrCode)
  const courseIdToStudentCount = new Map<string, number>();
  for (const e of enrollments) {
    const key = e.CrCode ?? e.CrTitle ?? "";
    courseIdToStudentCount.set(key, (courseIdToStudentCount.get(key) ?? 0) + 1);
  }

  return (
    <div
      className={cn(
        "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12 overflow-x-auto",
        className,
      )}
    >
      {enrollments.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
          No enrollment data found.
        </div>
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader className="sticky top-0 z-10 border-b border-stroke bg-white dark:bg-gray-dark dark:border-dark-3 [&>tr]:border-stroke dark:[&>tr]:border-dark-3">
              <TableRow className="border-none uppercase [&>th]:text-center [&>th]:bg-white [&>th]:dark:bg-gray-dark">
                <TableHead className="min-w-[160px] !text-left">
                  Student Name
                </TableHead>
                <TableHead className="min-w-[100px] !text-left">
                  SAP ID
                </TableHead>
                <TableHead className="min-w-[140px] !text-left">
                  Department
                </TableHead>
                <TableHead className="min-w-[120px] !text-left">
                  Program
                </TableHead>
                <TableHead className="min-w-[160px] !text-left">
                  Course
                </TableHead>
                <TableHead className="min-w-[160px] !text-left">
                  Instructor Name
                </TableHead>
                <TableHead className="min-w-[100px] !text-center">
                  Total students (course)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((row) => {
                const courseKey = row.CrCode ?? row.CrTitle ?? "";
                const totalForCourse =
                  courseIdToStudentCount.get(courseKey) ?? 0;
                const rowKey = row.Id ?? `${row.SapNo}-${courseKey}-${row.CrTitle}`;

                return (
                  <TableRow
                    key={rowKey}
                    className="text-center text-base font-medium text-dark dark:text-white"
                  >
                    <TableCell className="!text-left font-medium">
                      {returnToUrl ? (
                        <StudentProfileLink
                          sapId={row.SapNo}
                          returnToUrl={returnToUrl}
                          className="inline-flex items-center gap-2 text-green-500 hover:bg-gray-100 hover:text-dark dark:text-dark-5 dark:hover:bg-dark-3 dark:hover:text-white rounded-md p-2 -m-2"
                          title="View profile"
                        >
                          {row.Name ?? "—"}
                        </StudentProfileLink>
                      ) : (
                        row.Name ?? "—"
                      )}
                    </TableCell>
                    <TableCell className="!text-left text-dark-6">
                      {row.SapNo ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left text-dark-6">
                      {row.DeptName ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left">
                      {row.DegreeTitle ?? row.DegreeCode ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left">
                      <div className="flex flex-col gap-1">
                        <span>{row.CrTitle ?? row.CrCode ?? "—"}</span>
                        <span className="text-sm text-[#1f4a3d]">
                          {totalForCourse} students
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="!text-left">
                      {row.Teacher ?? "—"}
                    </TableCell>
                    <TableCell className="!text-center">
                      {totalForCourse}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// Group students by program -> course (for HoD; already scoped to department(s))
function groupStudentsForHod(
  students: Student[]
): Record<string, Record<string, Student[]>> {
  const result: Record<string, Record<string, Student[]>> = {};

  for (const student of students) {
    const courseId = student.course_id;
    const programId = getProgramFromCourse(courseId);

    if (!result[programId]) {
      result[programId] = {};
    }
    if (!result[programId][courseId]) {
      result[programId][courseId] = [];
    }
    result[programId][courseId].push(student);
  }

  return result;
}

const UNASSIGNED_INSTRUCTOR_ID = "__UNASSIGNED__";

// Group students by program -> instructor -> course (for HoD view)
function groupStudentsForHodInstructors(
  students: Student[],
  teachers: AppUser[],
  hodDepartmentIds: string[]
): Record<string, Record<string, Record<string, Student[]>>> {
  const result: Record<string, Record<string, Record<string, Student[]>>> = {};
  const teachersInDept = teachers.filter(
    (t) => t.role === "teacher" && t.department_id && hodDepartmentIds.includes(t.department_id)
  );
  const courseToInstructor = new Map<string, AppUser>();
  for (const t of teachersInDept) {
    if (t.course_ids) {
      for (const cid of t.course_ids) {
        courseToInstructor.set(cid, t);
      }
    }
  }

  for (const student of students) {
    const courseId = student.course_id;
    const programId = getProgramFromCourse(courseId);
    const instructor = courseToInstructor.get(courseId);
    const instructorId = instructor?.id ?? UNASSIGNED_INSTRUCTOR_ID;

    if (!result[programId]) result[programId] = {};
    if (!result[programId][instructorId]) result[programId][instructorId] = {};
    if (!result[programId][instructorId][courseId]) result[programId][instructorId][courseId] = [];
    result[programId][instructorId][courseId].push(student);
  }

  return result;
}

export async function NestedStudentsTable({
  className,
  returnToUrl = "/",
  expandedIds = [],
  selectedAlert = "all",
  user,
  masterFilter,
  gpaFilters,
  attendanceFilters,
  interventionFilters = [],
  sortBy = null,
  sortOrder = "asc",
}: PropsType) {
  const useSapNested = process.env.USE_SAP_MONITORING === "true";

  if (useSapNested) {
    const Campus = process.env.SAP_CAMPUS ?? "11";
    const PYear = process.env.SAP_PYEAR ?? "2026";
    const PSess = process.env.SAP_PSESS ?? "001";
    const Begda = process.env.SAP_BEGDA ?? "20260120";
    const Endda = process.env.SAP_ENDDA ?? "20260520";

    const entries = await fetchMonitoringEntries({
      Campus,
      PYear,
      PSess,
      Begda,
      Endda,
    });

    if (!entries.length) {
      return (
        <div
          className={cn(
            "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
            className,
          )}
        >
          <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
            No instructor monitoring data found for this period.
          </div>
        </div>
      );
    }

    type CourseInfo = {
      code: string;
      title: string;
      instructors: Set<string>;
    };

    const byDepartment = new Map<
      string,
      Map<string, Map<string, CourseInfo>>
    >();

    for (const e of entries) {
      const dept = (e.Department as string) ?? "Unknown Department";
      const program = (e.Degree as string) ?? "Unknown Program";
      const code = String(e.CrCode ?? "—");
      const title = (e.CrTitle as string) ?? "—";
      const instructor = (e.TeacherName as string) ?? "—";

      if (!byDepartment.has(dept)) {
        byDepartment.set(dept, new Map());
      }
      const progMap = byDepartment.get(dept)!;

      if (!progMap.has(program)) {
        progMap.set(program, new Map());
      }
      const courseMap = progMap.get(program)!;

      if (!courseMap.has(code)) {
        courseMap.set(code, {
          code,
          title,
          instructors: new Set(),
        });
      }
      courseMap.get(code)!.instructors.add(instructor);
    }

    const sortedDepartments = Array.from(byDepartment.keys()).sort((a, b) =>
      a.localeCompare(b),
    );

    return (
      <div
        className={cn(
          "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
          className,
        )}
      >
        <div className="mt-4 space-y-4">
          {sortedDepartments.map((deptName) => {
            const progMap = byDepartment.get(deptName)!;
            const deptSectionId = `sap-dept-${deptName}`;
            const sortedPrograms = Array.from(progMap.keys()).sort((a, b) =>
              a.localeCompare(b),
            );

            return (
              <details
                key={deptName}
                data-section-id={deptSectionId}
                open={expandedIds.includes(deptSectionId)}
                className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-semibold text-dark dark:text-white">
                      Department:{" "}
                      <span className="font-bold text-primary">{deptName}</span>
                    </span>
                  </div>
                  <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
                    ▼
                  </span>
                </summary>
                <div className="border-t border-stroke bg-white px-4 py-3 dark:border-dark-3 dark:bg-gray-dark">
                  <div className="space-y-3">
                    {sortedPrograms.map((programName) => {
                      const courseMap = progMap.get(programName)!;
                      const progSectionId = `${deptSectionId}-prog-${programName}`;
                      const sortedCourses = Array.from(courseMap.values()).sort(
                        (a, b) => a.code.localeCompare(b.code),
                      );

                      return (
                        <details
                          key={programName}
                          data-section-id={progSectionId}
                          open={expandedIds.includes(progSectionId)}
                          className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                        >
                          <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-dark dark:text-white">
                                Program:{" "}
                                <span className="font-bold text-primary">
                                  {programName}
                                </span>
                              </span>
                            </div>
                            <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
                              ▼
                            </span>
                          </summary>
                          <div className="border-t border-stroke bg-white px-4 py-3 dark:border-dark-3 dark:bg-gray-dark">
                            <div className="space-y-3">
                              {sortedCourses.map((course) => {
                                const courseSectionId = `${progSectionId}-course-${course.code}`;
                                const instructorNames = Array.from(
                                  course.instructors,
                                ).join(", ");

                                return (
                                  <details
                                    key={course.code}
                                    data-section-id={courseSectionId}
                                    open={expandedIds.includes(courseSectionId)}
                                    className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                                  >
                                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                                      <div className="flex flex-col gap-1">
                                        <span className="text-sm font-semibold text-dark dark:text-white">
                                          Course:{" "}
                                          <span className="font-bold text-primary">
                                            {course.code}
                                          </span>
                                          {course.title && (
                                            <span className="ml-2 text-xs text-dark-6 dark:text-dark-5">
                                              ({course.title})
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-xs text-dark-6 dark:text-dark-5">
                                          Instructor(s):{" "}
                                          <span className="font-semibold text-dark dark:text-white">
                                            {instructorNames || "—"}
                                          </span>
                                        </span>
                                      </div>
                                      <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
                                        ▼
                                      </span>
                                    </summary>
                                  </details>
                                );
                              })}
                            </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    );
  }

  const { students: initialStudents } = await getStudentsByAlert(
    selectedAlert,
    { page: 1, pageSize: 100000 },
    user,
    masterFilter,
    gpaFilters,
    attendanceFilters,
  );
  const statusMap = await getLatestInterventionStatusMap(
    initialStudents.map((s) => s.sap_id),
  );
  const filtered = applyInterventionFilters(
    initialStudents,
    interventionFilters,
    statusMap,
  );
  const students = sortStudents(filtered, sortBy, sortOrder);

  // For deans, show nested structure: Department -> Program -> Course -> Students
  if (user?.role === "dean") {
    const data = await getFullData();
    const grouped = groupStudentsForDean(students, data.departments, data.courses);

    // Map each course to one or more instructor names (for header display)
    const teachers = data.users.filter(
      (u) => u.role === "teacher" && u.course_ids && u.course_ids.length > 0,
    );
    const courseIdToInstructorNames = new Map<string, string>();
    for (const teacher of teachers) {
      for (const cid of teacher.course_ids ?? []) {
        const existing = courseIdToInstructorNames.get(cid);
        courseIdToInstructorNames.set(
          cid,
          existing ? `${existing}, ${teacher.name}` : teacher.name,
        );
      }
    }

    // Sort departments by name
    const sortedDepartments = data.departments
      .filter((d) => grouped[d.id])
      .sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div
        className={cn(
          "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
          className,
        )}
      >

        {students.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
            No students match this filter.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {sortedDepartments.map((department) => {
              const deptPrograms = grouped[department.id];
              const programEntries = Object.entries(deptPrograms).sort(([a], [b]) =>
                a.localeCompare(b),
              );
              const deptSectionId = `dept-${department.id}`;

              // Calculate department stats
              const deptStudents = Object.values(deptPrograms)
                .flatMap((prog) => Object.values(prog).flat());
              const deptGpaAlerts = deptStudents.filter(
                (s) => s.gpa.alert_level !== null,
              ).length;
              const deptAttendanceAlerts = deptStudents.filter(
                (s) => s.attendance.alert_level !== null,
              ).length;

              return (
                <details
                  key={department.id}
                  data-section-id={deptSectionId}
                  open={expandedIds.includes(deptSectionId)}
                  className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-base font-semibold text-dark dark:text-white">
                        Department:{" "}
                        <span className="font-bold text-primary">{department.name}</span>
                      </span>

                    </div>
                    <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
                      ▼
                    </span>
                  </summary>
                  <div className="border-t border-stroke bg-white px-4 py-3 dark:border-dark-3 dark:bg-gray-dark">
                    <div className="space-y-3">
                      {programEntries.map(([programId, programCourses]) => {
                        const courseEntries = Object.entries(programCourses).sort(
                          ([a], [b]) => a.localeCompare(b),
                        );
                        const programStudents = Object.values(programCourses).flat();
                        const programAlerts = getAlertCounts(programStudents);
                        const progSectionId = `${deptSectionId}-prog-${programId}`;

                        return (
                          <details
                            key={programId}
                            data-section-id={progSectionId}
                            open={expandedIds.includes(progSectionId)}
                            className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                          >
                            <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-dark dark:text-white">
                                  Program:{" "}
                                  <span className="font-bold text-primary">{programId}</span>
                                </span>
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-dark-6 dark:text-dark-5">
                                  <span>
                                    Students:{" "}
                                    <span className="font-semibold text-dark dark:text-white">
                                      {programStudents.length}
                                    </span>
                                  </span>
                                  <span>
                                    Attendance alerts:{" "}
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                      {programAlerts.attYellow}
                                    </span>
                                    {" | "}
                                    <span className="font-semibold text-red">
                                      {programAlerts.attRed}
                                    </span>
                                  </span>
                                  <span>
                                    GPA alerts:{" "}
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                      {programAlerts.gpaYellow}
                                    </span>
                                    {" | "}
                                    <span className="font-semibold text-red">
                                      {programAlerts.gpaRed}
                                    </span>
                                  </span>

                                </div>
                              </div>
                              <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
                                ▼
                              </span>
                            </summary>
                            <div className="border-t border-stroke bg-white px-4 py-3 dark:border-dark-3 dark:bg-gray-dark">
                              <div className="space-y-3">
                                {courseEntries.map(([courseId, courseStudents]) => {
                                  const course = data.courses.find((c) => c.id === courseId);
                                  const classesHeld =
                                    courseStudents[0]?.attendance.total_classes_held ?? 0;
                                  const averageAttendance =
                                    courseStudents.reduce(
                                      (sum, s) => sum + s.attendance.attendance_percentage,
                                      0,
                                    ) / courseStudents.length;
                                  const courseAlerts = getAlertCounts(courseStudents);
                                  const courseSectionId = `${progSectionId}-course-${courseId}`;

                                  return (
                                    <details
                                      key={courseId}
                                      data-section-id={courseSectionId}
                                      open={expandedIds.includes(courseSectionId)}
                                      className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                                    >
                                      <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                          <span className="text-sm font-semibold text-dark dark:text-white">
                                            Course:{" "}
                                            <span className="font-bold text-primary">
                                              {courseId}
                                            </span>
                                            {course && (
                                              <span className="ml-2 text-xs text-dark-6 dark:text-dark-5">
                                                ({course.name})
                                              </span>
                                            )}
                                            {courseIdToInstructorNames.get(courseId) && (
                                              <span className="ml-2 text-xs text-dark-6 dark:text-dark-5">
                                                – Instructor:{" "}
                                                {courseIdToInstructorNames.get(courseId)}
                                              </span>
                                            )}
                                          </span>
                                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-dark-6 dark:text-dark-5">
                                            <span>
                                              Classes held:{" "}
                                              <span className="font-semibold text-dark dark:text-white">
                                                {classesHeld}
                                              </span>
                                            </span>
                                            <span>
                                              Average attendance:{" "}
                                              <span className="font-semibold text-dark dark:text-white">
                                                {averageAttendance.toFixed(1)}%
                                              </span>
                                            </span>
                                            <span>
                                              Attendance alerts:{" "}
                                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                {courseAlerts.attYellow}
                                              </span>
                                              {" | "}
                                              <span className="font-semibold text-red">
                                                {courseAlerts.attRed}
                                              </span>
                                            </span>
                                            <span>
                                              GPA alerts:{" "}
                                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                {courseAlerts.gpaYellow}
                                              </span>
                                              {" | "}
                                              <span className="font-semibold text-red">
                                                {courseAlerts.gpaRed}
                                              </span>
                                            </span>

                                          </div>
                                        </div>
                                        <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
                                          ▼
                                        </span>
                                      </summary>
                                      <div className="border-t border-stroke bg-white px-2 py-3 dark:border-dark-3 dark:bg-gray-dark">
                                        <Table>
                                          <TableHeader className="sticky top-0 z-10 border-b border-stroke bg-white dark:bg-gray-dark dark:border-dark-3 [&>tr]:border-stroke dark:[&>tr]:border-dark-3">
                                            <TableRow className="border-none uppercase [&>th]:text-center [&>th]:bg-white [&>th]:dark:bg-gray-dark">
                                              <TableHead className="min-w-[140px] !text-left">
                                                Name
                                              </TableHead>
                                              <TableHead className="min-w-[100px] !text-left">
                                                SAP ID
                                              </TableHead>
                                            
                                              <TableHead className="text-center">Present</TableHead>
                                              <TableHead className="text-center">Absent</TableHead>
                                              <SortableTableHead sortKey="attendance" currentSort={sortBy} currentOrder={sortOrder}>
                                                Attendance %
                                              </SortableTableHead>
                                              <SortableTableHead sortKey="gpa" currentSort={sortBy} currentOrder={sortOrder}>
                                                GPA
                                              </SortableTableHead>
                                              <ClearSortButton />
                                              <TableHead className="min-w-[80px] !text-center">
                                                Intervention Status
                                              </TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {courseStudents.map((student) => {
                                              const trendSymbol =
                                                student.gpa.trend === "up"
                                                  ? "↗"
                                                  : student.gpa.trend === "down"
                                                    ? "↘"
                                                    : "→";
                                              const absent =
                                                student.attendance.total_classes_held -
                                                student.attendance.classes_attended;
                                              const gpaColor =
                                                student.gpa.alert_level === "critical"
                                                  ? "text-red font-semibold"
                                                  : student.gpa.alert_level === "warning"
                                                    ? "text-amber-600 dark:text-amber-400 font-semibold"
                                                    : "text-dark dark:text-white";
                                              const attColor =
                                                student.attendance.alert_level === "critical"
                                                  ? "text-red font-semibold"
                                                  : student.attendance.alert_level === "warning"
                                                    ? "text-amber-600 dark:text-amber-400 font-semibold"
                                                    : "text-dark dark:text-white";

                                              return (
                                                <TableRow
                                                  className="text-center text-base font-medium text-dark dark:text-white"
                                                  key={student.sap_id}
                                                >

                                                  <TableCell className="!text-left font-medium flex items-center gap-2">
                                                    <StudentProfileLink
                                                      sapId={student.sap_id}
                                                      returnToUrl={returnToUrl}
                                                      className="inline-flex items-center gap-2 text-green-500 hover:bg-gray-100 hover:text-dark dark:text-dark-5 dark:hover:bg-dark-3 dark:hover:text-white rounded-md p-2 -m-2"
                                                      title="View profile"
                                                    >
                                                      <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="20"
                                                        height="20"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                      >
                                                        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                                                        <circle cx="12" cy="12" r="3" />
                                                      </svg>
                                                      {student.name}
                                                    </StudentProfileLink>
                                                  </TableCell>
                                                  <TableCell className="!text-left text-dark-6">
                                                    {student.sap_id}
                                                  </TableCell>
                                                 
                                                 
                                                  <TableCell>
                                                    {student.attendance.classes_attended}
                                                  </TableCell>
                                                  <TableCell>{absent}</TableCell>
                                                  <TableCell className={cn(attColor)}>
                                                    {student.attendance.attendance_percentage.toFixed(
                                                      1,
                                                    )}
                                                    %
                                                  </TableCell>
                                                  <TableCell className={cn(gpaColor)}>
                                                    {student.gpa.current}
                                                    <span
                                                      className="ml-1 text-dark-6"
                                                      title={student.gpa.trend}
                                                    >
                                                      {trendSymbol}
                                                    </span>
                                                    {student.gpa.change !== 0 && (
                                                      <span
                                                        className={cn(
                                                          "ml-1 text-xs",
                                                          student.gpa.change < 0
                                                            ? "text-red"
                                                            : "text-green",
                                                        )}
                                                      >
                                                        ({student.gpa.change > 0 ? "+" : ""}
                                                        {student.gpa.change})
                                                      </span>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="w-0 min-w-0 p-0" />
                                                  <TableCell>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <InterventionStatusBadge
                                                        status={statusMap.get(student.sap_id) ?? null}
                                                        goodStanding={student.gpa.alert_level == null && student.attendance.alert_level == null}
                                                      />
                                                    </div>
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </details>
                                  );
                                })}
                              </div>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // For HoD, show nested structure: Program -> Instructors -> Courses -> Students
  if (user?.role === "hod") {
    const data = await getFullData();
    const hodDepartmentIds = user.department_ids ?? [];
    const grouped = groupStudentsForHodInstructors(
      students,
      data.users,
      hodDepartmentIds,
    );
    const programEntries = Object.entries(grouped).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    const getInstructorName = (instructorId: string) => {
      if (instructorId === UNASSIGNED_INSTRUCTOR_ID) return "Unassigned";
      const u = data.users.find((x) => x.id === instructorId);
      return u?.name ?? instructorId;
    };

    return (
      <div
        className={cn(
          "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
          className,
        )}
      >
      
        {students.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
            No students match this filter.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {programEntries.map(([programId, programInstructors]) => {
              const instructorEntries = Object.entries(programInstructors).sort(
                ([aId], [bId]) =>
                  getInstructorName(aId).localeCompare(getInstructorName(bId)),
              );
              const programStudents = Object.values(programInstructors).flatMap(
                (courses) => Object.values(courses).flat(),
              );
              const programAlerts = getAlertCounts(programStudents);
              const hodProgId = `hod-prog-${programId}`;

              return (
                <details
                  key={programId}
                  data-section-id={hodProgId}
                  open={expandedIds.includes(hodProgId)}
                  className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-base font-semibold text-dark dark:text-white">
                        Program:{" "}
                        <span className="font-bold text-primary">{programId}</span>
                      </span>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-dark-6 dark:text-dark-5">
                        <span>
                          Total students:{" "}
                          <span className="font-semibold text-dark dark:text-white">
                            {programStudents.length}
                          </span>
                        </span>
                        <span>
                          Attendance alerts:{" "}
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {programAlerts.attYellow}
                          </span>
                          {" | "}
                          <span className="font-semibold text-red">
                            {programAlerts.attRed}
                          </span>
                        </span>
                        <span>
                          GPA alerts:{" "}
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {programAlerts.gpaYellow}
                          </span>
                          {" | "}
                          <span className="font-semibold text-red">
                            {programAlerts.gpaRed}
                          </span>
                        </span>
                      </div>
                    </div>
                    <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
                      ▼
                    </span>
                  </summary>
                  <div className="border-t border-stroke bg-white px-4 py-3 dark:border-dark-3 dark:bg-gray-dark">
                    <div className="space-y-3">
                      {instructorEntries.map(([instructorId, instructorCourses]) => {
                        const courseEntries = Object.entries(instructorCourses).sort(
                          ([a], [b]) => a.localeCompare(b),
                        );
                        const instructorStudents = Object.values(
                          instructorCourses,
                        ).flat();
                        const instructorAlerts = getAlertCounts(instructorStudents);
                        const hodInstId = `${hodProgId}-inst-${instructorId}`;

                        return (
                          <details
                            key={instructorId}
                            data-section-id={hodInstId}
                            open={expandedIds.includes(hodInstId)}
                            className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                          >
                            <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-dark dark:text-white">

                                  <span className="font-bold text-primary">
                                    {getInstructorName(instructorId)}
                                  </span>
                                </span>
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-dark-6 dark:text-dark-5">
                                  <span>
                                    Students:{" "}
                                    <span className="font-semibold text-dark dark:text-white">
                                      {instructorStudents.length}
                                    </span>
                                  </span>
                                  <span>
                                    Attendance alerts:{" "}
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                      {instructorAlerts.attYellow}
                                    </span>
                                    {" | "}
                                    <span className="font-semibold text-red">
                                      {instructorAlerts.attRed}
                                    </span>
                                  </span>
                                  <span>
                                    GPA alerts:{" "}
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                      {instructorAlerts.gpaYellow}
                                    </span>
                                    {" | "}
                                    <span className="font-semibold text-red">
                                      {instructorAlerts.gpaRed}
                                    </span>
                                  </span>
                                </div>
                              </div>
                              <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
                                ▼
                              </span>
                            </summary>
                            <div className="border-t border-stroke bg-white px-4 py-3 dark:border-dark-3 dark:bg-gray-dark">
                              <div className="space-y-3">
                                {courseEntries.map(([courseId, courseStudents]) => {
                                  const course = data.courses.find(
                                    (c) => c.id === courseId,
                                  );
                                  const classesHeld =
                                    courseStudents[0]?.attendance.total_classes_held ??
                                    0;
                                  const averageAttendance =
                                    courseStudents.reduce(
                                      (sum, s) =>
                                        sum + s.attendance.attendance_percentage,
                                      0,
                                    ) / courseStudents.length;
                                  const courseAlertsHod = getAlertCounts(courseStudents);
                                  const hodCourseId = `${hodInstId}-course-${courseId}`;

                                  return (
                                    <details
                                      key={courseId}
                                      data-section-id={hodCourseId}
                                      open={expandedIds.includes(hodCourseId)}
                                      className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                                    >
                                      <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                          <span className="text-sm font-semibold text-dark dark:text-white">
                                            Course:{" "}
                                            <span className="font-bold text-primary">
                                              {courseId}
                                            </span>
                                            {course && (
                                              <span className="ml-2 text-xs text-dark-6 dark:text-dark-5">
                                                ({course.name})
                                              </span>
                                            )}
                                            <span className="ml-2 text-xs text-dark-6 dark:text-dark-5">
                                              – Instructor: {getInstructorName(instructorId)}
                                            </span>
                                          </span>
                                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-dark-6 dark:text-dark-5">
                                            <span>
                                              Classes held:{" "}
                                              <span className="font-semibold text-dark dark:text-white">
                                                {classesHeld}
                                              </span>
                                            </span>
                                            <span>
                                              Average attendance:{" "}
                                              <span className="font-semibold text-dark dark:text-white">
                                                {averageAttendance.toFixed(1)}%
                                              </span>
                                            </span>
                                            <span>
                                              Attendance alerts:{" "}
                                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                {courseAlertsHod.attYellow}
                                              </span>
                                              {" | "}
                                              <span className="font-semibold text-red">
                                                {courseAlertsHod.attRed}
                                              </span>
                                            </span>
                                            <span>
                                              GPA alerts:{" "}
                                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                {courseAlertsHod.gpaYellow}
                                              </span>
                                              {" | "}
                                              <span className="font-semibold text-red">
                                                {courseAlertsHod.gpaRed}
                                              </span>
                                            </span>
                                          </div>
                                        </div>
                                        <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
                                          ▼
                                        </span>
                                      </summary>
                                      <div className="border-t border-stroke bg-white px-2 py-3 dark:border-dark-3 dark:bg-gray-dark">
                                        <Table>
                                          <TableHeader className="sticky top-0 z-10 border-b border-stroke bg-white dark:bg-gray-dark dark:border-dark-3 [&>tr]:border-stroke dark:[&>tr]:border-dark-3">
                                            <TableRow className="border-none uppercase [&>th]:text-center [&>th]:bg-white [&>th]:dark:bg-gray-dark">
                                              <TableHead className="min-w-[140px] !text-left">
                                                Name
                                              </TableHead>
                                              <TableHead className="min-w-[100px] !text-left">
                                                SAP ID
                                              </TableHead>
                                          
                                              
                                              <TableHead className="text-center">Present</TableHead>
                                              <TableHead className="text-center">Absent</TableHead>
                                              <SortableTableHead sortKey="attendance" currentSort={sortBy} currentOrder={sortOrder}>
                                                Attendance %
                                              </SortableTableHead>
                                              <SortableTableHead sortKey="gpa" currentSort={sortBy} currentOrder={sortOrder}>
                                                GPA
                                              </SortableTableHead>
                                              <ClearSortButton />
                                              <TableHead className="min-w-[80px] !text-left">
                                                Intervention Status
                                              </TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {courseStudents.map((student) => {
                                              const trendSymbol =
                                                student.gpa.trend === "up"
                                                  ? "↗"
                                                  : student.gpa.trend === "down"
                                                    ? "↘"
                                                    : "→";
                                              const absent =
                                                student.attendance.total_classes_held -
                                                student.attendance.classes_attended;
                                              const gpaColor =
                                                student.gpa.alert_level === "critical"
                                                  ? "text-red font-semibold"
                                                  : student.gpa.alert_level === "warning"
                                                    ? "text-amber-600 dark:text-amber-400 font-semibold"
                                                    : "text-dark dark:text-white";
                                              const attColor =
                                                student.attendance.alert_level === "critical"
                                                  ? "text-red font-semibold"
                                                  : student.attendance.alert_level === "warning"
                                                    ? "text-amber-600 dark:text-amber-400 font-semibold"
                                                    : "text-dark dark:text-white";

                                              return (
                                                <TableRow
                                                  className="text-center text-base font-medium text-dark dark:text-white"
                                                  key={student.sap_id}
                                                >
                                                  <TableCell className="!text-left font-medium">
                                                    <StudentProfileLink
                                                      sapId={student.sap_id}
                                                      returnToUrl={returnToUrl}
                                                      className="inline-flex items-center gap-2 text-green-500 hover:bg-gray-100 hover:text-dark dark:text-dark-5 dark:hover:bg-dark-3 dark:hover:text-white rounded-md p-2 -m-2"
                                                      title="View profile"
                                                    >
                                                      {student.name}
                                                    </StudentProfileLink>
                                                  </TableCell>
                                                  <TableCell className="!text-left text-dark-6">
                                                    {student.sap_id}
                                                  </TableCell>
                                                
                                                 
                                                  <TableCell>
                                                    {student.attendance.classes_attended}
                                                  </TableCell>
                                                  <TableCell>{absent}</TableCell>
                                                  <TableCell className={cn(attColor)}>
                                                    {student.attendance.attendance_percentage.toFixed(
                                                      1,
                                                    )}
                                                    %
                                                  </TableCell>
                                                  <TableCell className={cn(gpaColor)}>
                                                    {student.gpa.current}
                                                    <span
                                                      className="ml-1 text-dark-6"
                                                      title={student.gpa.trend}
                                                    >
                                                      {trendSymbol}
                                                    </span>
                                                    {student.gpa.change !== 0 && (
                                                      <span
                                                        className={cn(
                                                          "ml-1 text-xs",
                                                          student.gpa.change < 0
                                                            ? "text-red"
                                                            : "text-green",
                                                        )}
                                                      >
                                                        ({student.gpa.change > 0 ? "+" : ""}
                                                        {student.gpa.change})
                                                      </span>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="w-0 min-w-0 p-0" />
                                                  <TableCell>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <InterventionStatusBadge
                                                        status={statusMap.get(student.sap_id) ?? null}
                                                        goodStanding={student.gpa.alert_level == null && student.attendance.alert_level == null}
                                                      />
                                                     
                                                    </div>
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </details>
                                  );
                                })}
                              </div>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Original logic for non-dean users (teachers)
  const groupedByCourse = students.reduce<Record<string, typeof students>>(
    (acc, student) => {
      const key = student.course_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(student);
      return acc;
    },
    {},
  );

  const groupedEntries = Object.entries(groupedByCourse).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div
      className={cn(
        "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
        className,
      )}
    >
      
      {students.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
          No students match this filter.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {groupedEntries.map(([courseId, courseStudents]) => {
            const classesHeld =
              courseStudents[0]?.attendance.total_classes_held ?? 0;
            const averageAttendance =
              courseStudents.reduce(
                (sum, s) => sum + s.attendance.attendance_percentage,
                0,
              ) / courseStudents.length;
            const courseAlertsTeacher = getAlertCounts(courseStudents);
            const teacherCourseId = `teacher-course-${courseId}`;

            return (
              <details
                key={courseId}
                data-section-id={teacherCourseId}
                open={expandedIds.includes(teacherCourseId)}
                className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-dark dark:text-white">
                      Course:{" "}
                      <span className="font-bold text-primary">{courseId}</span>
                      {user?.name && (
                        <span className="text-sm font-semibold text-dark dark:text-white">
                          – Instructor: {user.name}
                        </span>
                      )}
                    </span>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-dark-6 dark:text-dark-5">
                      <span>
                        Classes held:{" "}
                        <span className="font-semibold text-dark dark:text-white">
                          {classesHeld}
                        </span>
                      </span>
                      <span>
                        Average attendance:{" "}
                        <span className="font-semibold text-dark dark:text-white">
                          {averageAttendance.toFixed(1)}%
                        </span>
                      </span>
                      <span>
                        Attendance alerts:{" "}
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {courseAlertsTeacher.attYellow}
                        </span>
                        {" | "}
                        <span className="font-semibold text-red">
                          {courseAlertsTeacher.attRed}
                        </span>
                      </span>
                      <span>
                        GPA alerts:{" "}
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {courseAlertsTeacher.gpaYellow}
                        </span>
                        {" | "}
                        <span className="font-semibold text-red">
                          {courseAlertsTeacher.gpaRed}
                        </span>
                      </span>
                    </div>
                  </div>
                  <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
                    ▼
                  </span>
                </summary>
                <div className="border-t border-stroke bg-white px-2 py-3 dark:border-dark-3 dark:bg-gray-dark">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 border-b border-stroke bg-white dark:bg-gray-dark dark:border-dark-3 [&>tr]:border-stroke dark:[&>tr]:border-dark-3">
                      <TableRow className="border-none uppercase [&>th]:text-center [&>th]:bg-white [&>th]:dark:bg-gray-dark">
                        <TableHead className="min-w-[140px] !text-left">
                          Name
                        </TableHead>
                        <TableHead className="min-w-[100px] !text-left">
                          SAP ID
                        </TableHead>
                   
                      
                        <TableHead className="text-center">Present</TableHead>
                        <TableHead className="text-center">Absent</TableHead>
                        <SortableTableHead sortKey="attendance" currentSort={sortBy} currentOrder={sortOrder}>
                          Attendance %
                        </SortableTableHead>
                        <SortableTableHead sortKey="gpa" currentSort={sortBy} currentOrder={sortOrder}>
                          GPA
                        </SortableTableHead>
                        <ClearSortButton />
                        <TableHead className="min-w-[80px] !text-left">
                          Intervention Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courseStudents.map((student) => {
                        const trendSymbol =
                          student.gpa.trend === "up"
                            ? "↗"
                            : student.gpa.trend === "down"
                              ? "↘"
                              : "→";
                        const absent =
                          student.attendance.total_classes_held -
                          student.attendance.classes_attended;
                        const gpaColor =
                          student.gpa.alert_level === "critical"
                            ? "text-red font-semibold"
                            : student.gpa.alert_level === "warning"
                              ? "text-amber-600 dark:text-amber-400 font-semibold"
                              : "text-dark dark:text-white";
                        const attColor =
                          student.attendance.alert_level === "critical"
                            ? "text-red font-semibold"
                            : student.attendance.alert_level === "warning"
                              ? "text-amber-600 dark:text-amber-400 font-semibold"
                              : "text-dark dark:text-white";

                        return (
                          <TableRow
                            className="text-center text-base font-medium text-dark dark:text-white"
                            key={student.sap_id}
                          >
                            <TableCell className="!text-left font-medium">
                              <StudentProfileLink
                                sapId={student.sap_id}
                                returnToUrl={returnToUrl}
                                className="inline-flex items-center gap-2 text-green-500 hover:bg-gray-100 hover:text-dark dark:text-dark-5 dark:hover:bg-dark-3 dark:hover:text-white rounded-md p-2 -m-2"
                                title="View profile"
                              >
                                {student.name}
                              </StudentProfileLink>
                            </TableCell>
                            <TableCell className="!text-left text-dark-6">
                              {student.sap_id}
                            </TableCell>
                           
                           


                            <TableCell>
                              {student.attendance.classes_attended}
                            </TableCell>
                            <TableCell>{absent}</TableCell>
                            <TableCell className={cn(attColor)}>
                              {student.attendance.attendance_percentage.toFixed(
                                1,
                              )}
                              %
                            </TableCell>
                            <TableCell className={cn(gpaColor)}>
                              {student.gpa.current}
                              <span
                                className="ml-1 text-dark-6"
                                title={student.gpa.trend}
                              >
                                {trendSymbol}
                              </span>
                              {student.gpa.change !== 0 && (
                                <span
                                  className={cn(
                                    "ml-1 text-xs",
                                    student.gpa.change < 0
                                      ? "text-red"
                                      : "text-green",
                                  )}
                                >
                                  ({student.gpa.change > 0 ? "+" : ""}
                                  {student.gpa.change})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="w-0 min-w-0 p-0" />
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                <InterventionStatusBadge
                                                        status={statusMap.get(student.sap_id) ?? null}
                                                        goodStanding={student.gpa.alert_level == null && student.attendance.alert_level == null}
                                                      />
                                <StudentActionDropdown student={student} latestResult={null} />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}