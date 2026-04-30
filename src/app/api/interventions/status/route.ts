import { NextResponse } from "next/server";
import {
  getAllLatestInterventionStatuses,
  getLatestInterventionStatusMap,
} from "@/data/intervention-store";
import { getInterventionStatsForStudents } from "@/data/intervention-store";
import { getInterventionStatsForRoleScope } from "@/data/intervention-store";

export async function GET() {
  const statusMap = await getAllLatestInterventionStatuses();
  const result: Record<string, string | null> = {};
  for (const [sapId, status] of statusMap.entries()) {
    result[sapId] = status ?? null;
  }
  return NextResponse.json(result, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sapIds?: string[] };
    const sapIds = Array.isArray(body?.sapIds)
      ? body.sapIds.map((s) => String(s).trim()).filter(Boolean)
      : [];

    // Role-scope count mode (no SAPIDs sent).
    const roleScope = body as {
      role?: "dean" | "hod" | "teacher" | "superadmin";
      interventionType?: "attendance" | "gpa" | "all";
      alertLevel?: "warning" | "critical" | null;
      facultyId?: string | null;
      departmentIds?: string[] | null;
      courseIds?: string[] | null;
      instructorIds?: string[] | null;
      staffId?: string | null;
    };

    if (
      roleScope.role &&
      roleScope.interventionType &&
      (roleScope.role === "dean" ||
        roleScope.role === "hod" ||
        roleScope.role === "teacher" ||
        roleScope.role === "superadmin")
    ) {
      const stats = await getInterventionStatsForRoleScope({
        role: roleScope.role,
        interventionType: roleScope.interventionType,
        alertLevel: roleScope.alertLevel ?? null,
        facultyId: roleScope.facultyId ?? null,
        departmentIds: roleScope.departmentIds ?? null,
        courseIds: roleScope.courseIds ?? null,
        instructorIds: roleScope.instructorIds ?? null,
        staffId: roleScope.staffId ?? null,
      });
      return NextResponse.json(stats, { status: 200 });
    }

    if (!sapIds.length) return NextResponse.json({}, { status: 200 });

    const uniqueSapIds = Array.from(new Set(sapIds));
    const stats = await getInterventionStatsForStudents(uniqueSapIds);
    return NextResponse.json(stats, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

