import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getOverviewData,
  getAttendanceCoverageData,
  mapSessionToAppUser,
} from "@/app/(home)/dashboard/fetch";
import { getInterventionStatsForStudents } from "@/data/intervention-store";
import {
  getStudentListing,
  type SessionScope,
} from "@/lib/db/student-listing";
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

function uniqueSapIdsFromListingRows(
  rows: Array<{ sapId?: string | null }>
): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    const sapId = String(r.sapId ?? "").trim();
    if (sapId) out.add(sapId);
  }
  return Array.from(out);
}

function toSessionScope(session: any): SessionScope | null {
  const role = session?.user?.role;
  if (
    role !== "superadmin" &&
    role !== "dean" &&
    role !== "hod" &&
    role !== "instructor"
  ) {
    return null;
  }
  return {
    role,
    faculty_id: session?.user?.faculty_id ?? null,
    department_ids: Array.isArray(session?.user?.department_ids)
      ? session.user.department_ids
      : null,
    pernr: session?.user?.pernr ?? null,
  };
}

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

  const baseScope = toSessionScope(session as any);
  if (!baseScope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessionUser = mapSessionToAppUser(
    session as Parameters<typeof mapSessionToAppUser>[0],
  );
  let scope: SessionScope = baseScope;
  let user = sessionUser;
  // Allow superadmin dean/hod/teacher emulation from dashboard UI scope payload.
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
    scope = {
      role: body.roleScope.role === "teacher" ? "instructor" : body.roleScope.role,
      faculty_id: body.roleScope.facultyId ?? null,
      department_ids: body.roleScope.departmentIds?.length
        ? body.roleScope.departmentIds
        : null,
      pernr: body.roleScope.pernr ?? null,
    };
  }

  const [overview, attendanceCoverage, attendanceYellow, attendanceRed, gpaYellow, gpaRed] =
    await Promise.all([
      getOverviewData(
        user,
        body.masterFilter,
        body.gpaFilters,
        body.attendanceFilters,
      ),
      getAttendanceCoverageData(user, body.masterFilter),
      getStudentListing(scope, {
        page: 1,
        pageSize: 100000,
        filters: {
          ...(body.masterFilter ?? {}),
          attendanceFilters: ["yellow"],
          gpaFilters: body.gpaFilters,
        },
      }),
      getStudentListing(scope, {
        page: 1,
        pageSize: 100000,
        filters: {
          ...(body.masterFilter ?? {}),
          attendanceFilters: ["red"],
          gpaFilters: body.gpaFilters,
        },
      }),
      getStudentListing(scope, {
        page: 1,
        pageSize: 100000,
        filters: {
          ...(body.masterFilter ?? {}),
          gpaFilters: ["yellow"],
          attendanceFilters: body.attendanceFilters,
        },
      }),
      getStudentListing(scope, {
        page: 1,
        pageSize: 100000,
        filters: {
          ...(body.masterFilter ?? {}),
          gpaFilters: ["red"],
          attendanceFilters: body.attendanceFilters,
        },
      }),
    ]);

  const [
    attendanceYellowStats,
    attendanceRedStats,
    gpaYellowStats,
    gpaRedStats,
  ] = await Promise.all([
    getInterventionStatsForStudents(
      uniqueSapIdsFromListingRows(attendanceYellow.rows),
    ),
    getInterventionStatsForStudents(uniqueSapIdsFromListingRows(attendanceRed.rows)),
    getInterventionStatsForStudents(uniqueSapIdsFromListingRows(gpaYellow.rows)),
    getInterventionStatsForStudents(uniqueSapIdsFromListingRows(gpaRed.rows)),
  ]);

  // Keep card gross counts aligned with daily ETL aggregate table (alert_counts_by_dimension).
  const grossAttendanceYellow = overview.yellowAttendance?.value ?? 0;
  const grossAttendanceRed = overview.redAttendance?.value ?? 0;
  const grossGpaYellow = overview.yellowGpa?.value ?? 0;
  const grossGpaRed = overview.redGpa?.value ?? 0;

  const resolvedAttendanceYellow = attendanceYellowStats.resolved ?? 0;
  const resolvedAttendanceRed = attendanceRedStats.resolved ?? 0;
  const resolvedGpaYellow = gpaYellowStats.resolved ?? 0;
  const resolvedGpaRed = gpaRedStats.resolved ?? 0;

  return NextResponse.json({
    totalStudents: overview.totalStudents ?? 0,
    attendance: {
      grossYellow: grossAttendanceYellow,
      grossRed: grossAttendanceRed,
      resolvedYellow: resolvedAttendanceYellow,
      resolvedRed: resolvedAttendanceRed,
      netYellow: Math.max(0, grossAttendanceYellow - resolvedAttendanceYellow),
      netRed: Math.max(0, grossAttendanceRed - resolvedAttendanceRed),
      updatedAttendance: attendanceCoverage.updatedAttendance,
      totalClassesHeld: attendanceCoverage.totalClassesHeld,
    },
    gpa: {
      grossYellow: grossGpaYellow,
      grossRed: grossGpaRed,
      resolvedYellow: resolvedGpaYellow,
      resolvedRed: resolvedGpaRed,
      netYellow: Math.max(0, grossGpaYellow - resolvedGpaYellow),
      netRed: Math.max(0, grossGpaRed - resolvedGpaRed),
    },
  });
}

