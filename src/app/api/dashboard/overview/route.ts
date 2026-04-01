import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getOverviewData,
  getAttendanceCoverageData,
  getStudentsByAlert,
  mapSessionToAppUser,
} from "@/app/(home)/dashboard/fetch";
import { getInterventionStatsForStudents } from "@/data/intervention-store";
import type {
  AlertDimensionFilter,
  MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";

type Body = {
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
};

function uniqueSapIdsFromStudents(
  students: Array<{ sap_id?: string | null }>,
): string[] {
  const out = new Set<string>();
  for (const s of students) {
    const sapId = String(s.sap_id ?? "").trim();
    if (sapId) out.add(sapId);
  }
  return Array.from(out);
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

  const user = mapSessionToAppUser(
    session as Parameters<typeof mapSessionToAppUser>[0],
  );

  const [overview, attendanceCoverage, attendanceYellow, attendanceRed, gpaYellow, gpaRed] =
    await Promise.all([
      getOverviewData(
        user,
        body.masterFilter,
        body.gpaFilters,
        body.attendanceFilters,
      ),
      getAttendanceCoverageData(user, body.masterFilter),
      getStudentsByAlert(
        "yellow_attendance",
        { page: 1, pageSize: 100000 },
        user,
        body.masterFilter,
        body.gpaFilters,
        body.attendanceFilters,
      ),
      getStudentsByAlert(
        "red_attendance",
        { page: 1, pageSize: 100000 },
        user,
        body.masterFilter,
        body.gpaFilters,
        body.attendanceFilters,
      ),
      getStudentsByAlert(
        "yellow_gpa",
        { page: 1, pageSize: 100000 },
        user,
        body.masterFilter,
        body.gpaFilters,
        body.attendanceFilters,
      ),
      getStudentsByAlert(
        "red_gpa",
        { page: 1, pageSize: 100000 },
        user,
        body.masterFilter,
        body.gpaFilters,
        body.attendanceFilters,
      ),
    ]);

  const [
    attendanceYellowStats,
    attendanceRedStats,
    gpaYellowStats,
    gpaRedStats,
  ] = await Promise.all([
    getInterventionStatsForStudents(
      uniqueSapIdsFromStudents(attendanceYellow.students),
    ),
    getInterventionStatsForStudents(uniqueSapIdsFromStudents(attendanceRed.students)),
    getInterventionStatsForStudents(uniqueSapIdsFromStudents(gpaYellow.students)),
    getInterventionStatsForStudents(uniqueSapIdsFromStudents(gpaRed.students)),
  ]);

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

