import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getOverviewData,
  getAttendanceCoverageData,
  mapSessionToAppUser,
} from "@/app/(home)/dashboard/fetch";
import type {
  AlertDimensionFilter,
  MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";

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

  const [overview, attendanceCoverage] = await Promise.all([
    getOverviewData(
      user,
      body.masterFilter,
      body.gpaFilters,
      body.attendanceFilters,
    ),
    getAttendanceCoverageData(user, body.masterFilter),
  ]);

  const grossAttendanceYellow = overview.yellowAttendance?.value ?? 0;
  const grossAttendanceRed = overview.redAttendance?.value ?? 0;
  const grossGpaYellow = overview.yellowGpa?.value ?? 0;
  const grossGpaRed = overview.redGpa?.value ?? 0;

  return NextResponse.json({
    totalStudents: overview.totalStudents ?? 0,
    attendance: {
      grossYellow: grossAttendanceYellow,
      grossRed: grossAttendanceRed,
      updatedAttendance: attendanceCoverage.updatedAttendance,
      totalClassesHeld: attendanceCoverage.totalClassesHeld,
    },
    gpa: {
      grossYellow: grossGpaYellow,
      grossRed: grossGpaRed,
    },
  });
}
