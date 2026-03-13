import type {
  EnrollmentRecord,
  DepartmentStats,
  ProgramStats,
  InstructorStats,
  MasterFilterOptions,
  MasterFilterParams,
} from "./types";
import { FACULTY_ID_TO_ENROLLMENT_FAC_ID } from "./constants";

function filterByFaculty(
  records: EnrollmentRecord[],
  facultyId?: string | null
): EnrollmentRecord[] {
  if (!facultyId) return records;
  const enrollmentFacId = FACULTY_ID_TO_ENROLLMENT_FAC_ID[facultyId] ?? facultyId;
  return records.filter((r) => r.FacId === enrollmentFacId);
}

/** Derive department stats from enrollment records. */
export function getDepartmentStats(
  records: EnrollmentRecord[],
  facultyId?: string | null
): DepartmentStats[] {
  const list = filterByFaculty(records, facultyId);
  const byDept = new Map<string, { name: string; sapIds: Set<string> }>();
  for (const r of list) {
    const id = r.DeptCode || r.DeptId;
    const name = (r.DeptName ?? "").trim() || id;
    if (!id) continue;
    if (!byDept.has(id)) byDept.set(id, { name, sapIds: new Set() });
    byDept.get(id)!.sapIds.add(r.SapNo);
  }
  return Array.from(byDept.entries())
    .map(([departmentId, { name, sapIds }]) => ({
      departmentId,
      departmentName: name,
      total: sapIds.size,
      yellowGpa: 0,
      redGpa: 0,
      yellowAttendance: 0,
      redAttendance: 0,
    }))
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
}

/** Derive program stats from enrollment records. */
export function getProgramStats(
  records: EnrollmentRecord[],
  facultyId?: string | null,
  options?: { departmentIds?: string[] }
): ProgramStats[] {
  let list = filterByFaculty(records, facultyId);
  if (options?.departmentIds?.length) {
    const deptSet = new Set(options.departmentIds);
    list = list.filter((r) => deptSet.has(r.DeptCode) || deptSet.has(r.DeptId));
  }
  const byProgram = new Map<string, { title: string; sapIds: Set<string> }>();
  for (const r of list) {
    const id = (r.DegreeCode ?? r.DeptCode ?? "").trim();
    const title = (r.DegreeTitle ?? r.DeptName ?? id ?? "Unknown").trim();
    if (!id) continue;
    if (!byProgram.has(id)) byProgram.set(id, { title, sapIds: new Set() });
    byProgram.get(id)!.sapIds.add(r.SapNo);
  }
  return Array.from(byProgram.entries())
    .map(([programId, { title, sapIds }]) => ({
      programId,
      programTitle: title,
      total: sapIds.size,
      yellowGpa: 0,
      redGpa: 0,
      yellowAttendance: 0,
      redAttendance: 0,
    }))
    .sort((a, b) => (a.programTitle || a.programId).localeCompare(b.programTitle || b.programId));
}

/** Derive instructor stats from enrollment records (group by Pernr = teacher employee number). */
export function getInstructorStats(
  records: EnrollmentRecord[],
  facultyId?: string | null,
  options?: { departmentIds?: string[]; instructorIds?: string[] }
): InstructorStats[] {
  let list = filterByFaculty(records, facultyId);
  if (options?.departmentIds?.length) {
    const deptSet = new Set(options.departmentIds);
    list = list.filter((r) => deptSet.has(r.DeptCode) || deptSet.has(r.DeptId));
  }
  if (options?.instructorIds?.length) {
    const instructorSet = new Set(options.instructorIds);
    list = list.filter((r) => r.Pernr && instructorSet.has(r.Pernr));
  }
  const byInstructor = new Map<string, { name: string; sapIds: Set<string> }>();
  for (const r of list) {
    const pernr = (r.Pernr ?? "").trim();
    if (!pernr) continue;
    const name = (r.Teacher ?? pernr).trim();
    if (!byInstructor.has(pernr)) byInstructor.set(pernr, { name, sapIds: new Set() });
    byInstructor.get(pernr)!.sapIds.add(r.SapNo);
  }
  return Array.from(byInstructor.entries())
    .map(([instructorId, { name, sapIds }]) => ({
      instructorId,
      instructorName: name,
      total: sapIds.size,
      yellowGpa: 0,
      redGpa: 0,
      yellowAttendance: 0,
      redAttendance: 0,
    }))
    .sort((a, b) => a.instructorName.localeCompare(b.instructorName));
}

/** Derive MasterFilter dropdown options from enrollment with cascade (department → program → course → instructor). */
export function getMasterFilterOptions(
  records: EnrollmentRecord[],
  facultyId?: string | null,
  current?: MasterFilterParams
): MasterFilterOptions {
  const listByFaculty = filterByFaculty(records, facultyId);

  const deptSet = new Set<string>();
  const deptLabels = new Map<string, string>();
  for (const r of listByFaculty) {
    const id = r.DeptCode || r.DeptId;
    if (id) {
      deptSet.add(id);
      deptLabels.set(id, (r.DeptName ?? id).trim());
    }
  }
  const departments = Array.from(deptSet)
    .sort((a, b) => (deptLabels.get(a) ?? a).localeCompare(deptLabels.get(b) ?? b))
    .map((value) => ({ value, label: deptLabels.get(value) ?? value }));

  let listForProgram = listByFaculty;
  if (current?.department_ids?.length) {
    const deptSetCur = new Set(current.department_ids);
    listForProgram = listForProgram.filter((r) => deptSetCur.has(r.DeptCode) || deptSetCur.has(r.DeptId));
  }
  const programSet = new Set<string>();
  const programLabels = new Map<string, string>();
  for (const r of listForProgram) {
    const degId = (r.DegreeCode ?? "").trim();
    if (degId) {
      programSet.add(degId);
      programLabels.set(degId, (r.DegreeTitle ?? r.DeptName ?? degId).trim());
    }
  }
  const programs = Array.from(programSet)
    .sort((a, b) => (programLabels.get(a) ?? a).localeCompare(programLabels.get(b) ?? b))
    .map((value) => ({ value, label: programLabels.get(value) ?? value }));

  let listForCourse = listForProgram;
  if (current?.programs?.length) {
    const progSet = new Set(current.programs);
    listForCourse = listForCourse.filter((r) => progSet.has((r.DegreeCode ?? "").trim()));
  }
  const courseSet = new Set<string>();
  const courseLabels = new Map<string, string>();
  for (const r of listForCourse) {
    const crKey = (r.CrCode ?? r.CrTitle ?? "").trim();
    if (crKey) {
      courseSet.add(crKey);
      courseLabels.set(crKey, (r.CrTitle ?? r.CrCode ?? crKey).trim());
    }
  }
  const courses = Array.from(courseSet)
    .sort((a, b) => (courseLabels.get(a) ?? a).localeCompare(courseLabels.get(b) ?? b))
    .map((value) => ({ value, label: courseLabels.get(value) ?? value }));

  let listForInstructor = listForCourse;
  if (current?.course_ids?.length) {
    const courseSetCur = new Set(current.course_ids);
    listForInstructor = listForInstructor.filter(
      (r) => courseSetCur.has(r.CrCode ?? "") || courseSetCur.has(r.CrTitle ?? "")
    );
  }
  const instructorSet = new Set<string>();
  const instructorLabels = new Map<string, string>();
  for (const r of listForInstructor) {
    const pernr = (r.Pernr ?? "").trim();
    if (pernr) {
      instructorSet.add(pernr);
      instructorLabels.set(pernr, (r.Teacher ?? pernr).trim());
    }
  }
  const instructors = Array.from(instructorSet)
    .sort((a, b) => (instructorLabels.get(a) ?? a).localeCompare(instructorLabels.get(b) ?? b))
    .map((value) => ({ value, label: instructorLabels.get(value) ?? value }));

  return { departments, programs, courses, instructors };
}

/** Filter enrollment records by master filter (department, program, instructor, course) and optional faculty. */
export function filterEnrollmentByMasterFilter(
  records: EnrollmentRecord[],
  masterFilter: MasterFilterParams,
  facultyId?: string | null
): EnrollmentRecord[] {
  let list = filterByFaculty(records, facultyId);
  if (masterFilter.department_ids?.length) {
    const set = new Set(masterFilter.department_ids);
    list = list.filter((r) => set.has(r.DeptCode) || set.has(r.DeptId));
  }
  if (masterFilter.programs?.length) {
    const set = new Set(masterFilter.programs);
    list = list.filter((r) => set.has((r.DegreeCode ?? "").trim()));
  }
  if (masterFilter.instructor_ids?.length) {
    const set = new Set(masterFilter.instructor_ids);
    list = list.filter((r) => r.Pernr && set.has(r.Pernr));
  }
  if (masterFilter.course_ids?.length) {
    const set = new Set(masterFilter.course_ids);
    list = list.filter((r) => set.has(r.CrCode ?? "") || set.has(r.CrTitle ?? ""));
  }
  return list;
}
