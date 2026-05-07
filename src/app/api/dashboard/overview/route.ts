import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { calculateMissingAttendance } from "@/lib/attendance-missing";
import { mapSessionToAppUser } from "@/app/(home)/dashboard/fetch";
import type {
  AlertDimensionFilter,
  MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";
import { getStudentListing, type SessionScope } from "@/lib/db/student-listing";

type Body = {
  roleScope?: {
    role: "dean" | "hod" | "teacher";
    facultyId?: string | null;
    departmentIds?: string[] | null;
    courseIds?: string[] | null;
    pernr?: string | null;
  };
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
  classStatusFilters?: string[];
  interventionFilters?: string[];
  resolutionFilters?: string[];
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.pernr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionUser = mapSessionToAppUser(
    session as Parameters<typeof mapSessionToAppUser>[0],
  );
  let user = sessionUser;
  if (sessionUser.role === "superadmin" && body.roleScope) {
    user = {
      ...sessionUser,
      role: body.roleScope.role,
      faculty_id: body.roleScope.facultyId ?? null,
      department_ids: body.roleScope.departmentIds?.length
        ? body.roleScope.departmentIds
        : null,
      department_id: body.roleScope.departmentIds?.[0] ?? null,
      course_ids: body.roleScope.courseIds?.length ? body.roleScope.courseIds : null,
      sap_id: body.roleScope.pernr || sessionUser.sap_id,
    };
  }

  const toSessionScope = (
    sourceUser: typeof user,
    roleScope: Body["roleScope"] | undefined
  ): SessionScope => {
    if (sourceUser.role === "superadmin" && roleScope) {
      return {
        role:
          roleScope.role === "teacher"
            ? "instructor"
            : roleScope.role,
        faculty_id: roleScope.facultyId ?? null,
        department_ids: roleScope.departmentIds?.length
          ? roleScope.departmentIds
          : null,
        pernr: roleScope.pernr ?? sourceUser.sap_id ?? null,
      };
    }
    return {
      role:
        sourceUser.role === "teacher"
          ? "instructor"
          : sourceUser.role === "wellbeing-head" ||
              sourceUser.role === "wellbeing-counseller"
            ? "wellbeing"
            : sourceUser.role,
      faculty_id: sourceUser.faculty_id ?? null,
      department_ids: sourceUser.department_ids?.length
        ? sourceUser.department_ids
        : null,
      pernr: sourceUser.sap_id ?? null,
    };
  };

  const normalizedAttendanceFilters =
    body.attendanceFilters?.includes("all")
      ? undefined
      : body.attendanceFilters;
  const normalizedGpaFilters = body.gpaFilters?.includes("all")
    ? undefined
    : body.gpaFilters;
  const normalizedClassStatusFilters =
    body.classStatusFilters?.length && !body.classStatusFilters.includes("all")
      ? body.classStatusFilters.filter((v) => v !== "all")
      : undefined;
  const normalizedResolutionFilters =
    body.resolutionFilters?.length && !body.resolutionFilters.includes("all")
      ? body.resolutionFilters.filter((v) => v !== "all")
      : undefined;

  const attendanceCoveragePromise = getStudentListing(
    toSessionScope(user, body.roleScope),
    {
      page: 1,
      pageSize: 100000,
      sortKey: "department",
      sortDirection: "asc",
      filters: {
        ...(body.masterFilter ?? {}),
        attendanceFilters: normalizedAttendanceFilters,
        gpaFilters: normalizedGpaFilters,
        classStatusFilters: normalizedClassStatusFilters,
        interventionFilters: body.interventionFilters,
        resolutionFilters: normalizedResolutionFilters,
      },
    }
  ).then((listing) => {
    const byClass = new Map<string, { held: number; marked: number }>();
    const attendanceYellowSapIds = new Set<string>();
    const attendanceRedSapIds = new Set<string>();
    const attendanceYellowStudentCourseCases = new Set<string>();
    const attendanceRedStudentCourseCases = new Set<string>();
    const gpaYellowSapIds = new Set<string>();
    const gpaRedSapIds = new Set<string>();
    const totalSapIds = new Set<string>();
    for (const row of listing.rows) {
      if (row.isActive === false) continue;
      if (row.sapId) totalSapIds.add(row.sapId);
      const classKey = `${row.courseId}__${row.sectionCode ?? "NO_SECTION"}__${row.eventPackageId ?? "NO_EVENT_PACKAGE"}__${row.courseTitle ?? row.courseId}`;
      const studentCourseCaseKey = `${row.sapId}__${row.courseId}__${row.sectionCode ?? "NO_SECTION"}__${row.eventPackageId ?? "NO_EVENT_PACKAGE"}`;
      if (row.attendanceAlertLevel === "warning" && row.sapId) {
        attendanceYellowSapIds.add(row.sapId);
        attendanceYellowStudentCourseCases.add(studentCourseCaseKey);
      }
      if (row.attendanceAlertLevel === "critical" && row.sapId) {
        attendanceRedSapIds.add(row.sapId);
        attendanceRedStudentCourseCases.add(studentCourseCaseKey);
      }
      if (row.gpaAlertLevel === "warning" && row.sapId) {
        gpaYellowSapIds.add(row.sapId);
      }
      if (row.gpaAlertLevel === "critical" && row.sapId) {
        gpaRedSapIds.add(row.sapId);
      }
      const held = Number(row.totalClassesHeld ?? 0);
      const marked = Number(row.attendanceMarkedClasses ?? 0);
      const existing = byClass.get(classKey);
      if (!existing) {
        byClass.set(classKey, { held, marked });
        continue;
      }
      if (held > existing.held) existing.held = held;
      if (marked > existing.marked) existing.marked = marked;
    }

    let totalClassesHeld = 0;
    let updatedAttendance = 0;
    let missingCount = 0;
    for (const value of byClass.values()) {
      totalClassesHeld += value.held;
      updatedAttendance += value.marked;
      missingCount += calculateMissingAttendance(value.held, value.marked);
    }
    return {
      totalStudents: totalSapIds.size,
      grossAttendanceYellow: attendanceYellowSapIds.size,
      grossAttendanceRed: attendanceRedSapIds.size,
      grossGpaYellow: gpaYellowSapIds.size,
      grossGpaRed: gpaRedSapIds.size,
      updatedAttendance,
      totalClassesHeld,
      missingCount,
      // "Cases" means student-course instances carrying that alert.
      attendanceCaseYellow: attendanceYellowStudentCourseCases.size,
      attendanceCaseRed: attendanceRedStudentCourseCases.size,
    };
  });

  const attendanceCoverage = await attendanceCoveragePromise;

  return NextResponse.json({
    totalStudents: attendanceCoverage.totalStudents,
    attendance: {
      grossYellow: attendanceCoverage.grossAttendanceYellow,
      grossRed: attendanceCoverage.grossAttendanceRed,
      caseYellow: attendanceCoverage.attendanceCaseYellow,
      caseRed: attendanceCoverage.attendanceCaseRed,
      updatedAttendance: attendanceCoverage.updatedAttendance,
      totalClassesHeld: attendanceCoverage.totalClassesHeld,
      missingCount: attendanceCoverage.missingCount,
    },
    gpa: {
      grossYellow: attendanceCoverage.grossGpaYellow,
      grossRed: attendanceCoverage.grossGpaRed,
    },
  });
}
