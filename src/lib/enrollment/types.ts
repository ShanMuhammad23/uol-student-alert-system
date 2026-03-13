/** One record from enrollment_data.json (one row per course enrollment; same student can appear multiple times). */
export type EnrollmentRecord = {
  CampCode?: string;
  CampText?: string;
  DeptCode: string;
  DeptName: string;
  DeptId: string;
  DegreeCode?: string;
  DegreeTitle?: string;
  CrCode?: string;
  CrTitle?: string;
  Section?: string;
  SapNo: string;
  Name?: string;
  Teacher?: string | null;
  /** Unique employee number of the teacher (Pernr). */
  Pernr?: string;
  FacId?: string;
  Id?: string;
  [key: string]: unknown;
};

export type DepartmentStats = {
  departmentId: string;
  departmentName: string;
  total: number;
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
};

export type ProgramStats = {
  programId: string;
  programTitle?: string;
  total: number;
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
};

export type InstructorStats = {
  instructorId: string;
  instructorName: string;
  total: number;
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
};

/** Minimal user shape for dean stats (avoids importing server-only fetch/auth). */
export type DeanStatsUser = {
  role: string;
  faculty_id: string | null;
};

/** User shape for dashboard (role + faculty_id; avoids importing server-only fetch). */
export type DashboardUser = {
  role: "dean" | "hod" | "teacher";
  faculty_id: string | null;
};

export type MasterFilterOptions = {
  departments: { value: string; label: string }[];
  programs: { value: string; label: string }[];
  instructors: { value: string; label: string }[];
  courses: { value: string; label: string }[];
};

export type MasterFilterParams = {
  department_ids?: string[];
  programs?: string[];
  instructor_ids?: string[];
  course_ids?: string[];
};
