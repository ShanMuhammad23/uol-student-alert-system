export type UserRole = "dean" | "hod" | "teacher";

export type User = {
  id: string;
  sap_id: string;
  name: string;
  email: string;
  role: UserRole;
  faculty_id: string | null;
  department_id: string | null;
  department_ids: string[] | null;
  course_ids: string[] | null;
};

export function getStudentsForRole(
  user: User | null | undefined,
  allStudents: { department_id: string; course_id: string; faculty_id?: string }[]
): typeof allStudents {
  if (user == null) return allStudents;
  switch (user.role) {
    case "dean":
      if (!user.faculty_id) return allStudents;
      return allStudents.filter((s) => s.faculty_id === user.faculty_id);
    case "hod":
      if (!user.department_ids?.length) return [];
      return allStudents.filter((s) => user.department_ids!.includes(s.department_id));
    case "teacher":
      if (!user.course_ids?.length) return [];
      return allStudents.filter((s) => user.course_ids!.includes(s.course_id));
    default:
      return [];
  }
}

export function getCoursesForRole<T extends { id: string; department_id: string }>(
  user: User | null | undefined,
  allCourses: T[]
): T[] {
  if (user == null) return allCourses;
  switch (user.role) {
    case "dean":
      return allCourses;
    case "hod":
      if (!user.department_ids?.length) return [];
      return allCourses.filter((c) => user.department_ids!.includes(c.department_id));
    case "teacher":
      if (!user.course_ids?.length) return [];
      return allCourses.filter((c) => user.course_ids!.includes(c.id));
    default:
      return [];
  }
}

export function getDepartmentsForRole<T extends { id: string; faculty_id?: string }>(
  user: User | null | undefined,
  allDepartments: T[]
): T[] {
  if (user == null) return allDepartments;
  switch (user.role) {
    case "dean":
      if (!user.faculty_id) return allDepartments;
      return allDepartments.filter((d) => d.faculty_id === user.faculty_id);
    case "hod":
      if (!user.department_ids?.length) return [];
      return allDepartments.filter((d) => user.department_ids!.includes(d.id));
    case "teacher":
      return allDepartments;
    default:
      return [];
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  dean: "Dean",
  hod: "Head of Department",
  teacher: "Teacher",
};

export const DASHBOARD_HEADERS: Record<UserRole, string> = {
  dean: "Faculty Overview - Dean Dashboard",
  hod: "Department Overview - HoD Dashboard",
  teacher: "Course Dashboard",
};
