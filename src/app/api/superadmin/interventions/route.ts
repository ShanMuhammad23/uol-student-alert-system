import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getInterventionListStatsFromDb,
  getInterventionsListFromDb,
  type InterventionListFilters,
} from "@/lib/db/interventions";

function parseFilters(searchParams: URLSearchParams): InterventionListFilters {
  const facultyId = searchParams.get("facultyId")?.trim() || null;
  const departmentId = searchParams.get("departmentId")?.trim() || null;
  const programId = searchParams.get("programId")?.trim() || null;
  const courseId = searchParams.get("courseId")?.trim() || null;
  const status = searchParams.get("status")?.trim() || null;
  return { facultyId, departmentId, programId, courseId, status };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filters = parseFilters(searchParams);
  const statsFilters = { ...filters, status: null };
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize")) || 50));

  const [list, stats] = await Promise.all([
    getInterventionsListFromDb(filters, { page, pageSize }),
    getInterventionListStatsFromDb(statsFilters),
  ]);

  return NextResponse.json({
    interventions: list.rows,
    total: list.total,
    page,
    pageSize,
    stats,
  });
}
