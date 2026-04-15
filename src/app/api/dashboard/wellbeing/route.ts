import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getWellbeingChartData,
  getWellbeingChartDataForWellbeingRole,
  mapSessionToAppUser,
} from "@/app/(home)/dashboard/fetch";
import type {
  AppUser,
  AlertDimensionFilter,
  MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";

type Body = {
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
  roleScope?: {
    role: "dean" | "hod" | "teacher" | "wellbeing";
    facultyId?: string | null;
    departmentIds?: string[] | null;
    pernr?: string | null;
  };
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionUser = mapSessionToAppUser(
    session as Parameters<typeof mapSessionToAppUser>[0]
  );
  const scopedRole: AppUser["role"] =
    body.roleScope?.role === "teacher"
      ? "instructor"
      : body.roleScope?.role === "dean" ||
          body.roleScope?.role === "hod" ||
          body.roleScope?.role === "wellbeing"
        ? body.roleScope.role
        : sessionUser.role;
  const user =
    sessionUser.role === "superadmin" && body.roleScope
      ? {
          ...sessionUser,
          role: scopedRole,
          faculty_id: body.roleScope.facultyId ?? null,
          department_ids: body.roleScope.departmentIds?.length
            ? body.roleScope.departmentIds
            : null,
          sap_id: body.roleScope.pernr ?? sessionUser.sap_id ?? null,
        }
      : sessionUser;

  try {
    const data =
      user.role === "wellbeing"
        ? await getWellbeingChartDataForWellbeingRole(user)
        : await getWellbeingChartData(
            user,
            body.masterFilter,
            body.gpaFilters,
            body.attendanceFilters
          );
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to load wellbeing chart" }, { status: 500 });
  }
}

