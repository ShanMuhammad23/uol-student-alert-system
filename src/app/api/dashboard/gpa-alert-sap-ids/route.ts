import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getSapIdsForGpaAlertSegment,
  mapSessionToAppUser,
} from "@/app/(home)/dashboard/fetch";
import type {
  AlertDimensionFilter,
  MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";

type RoleScopeBody = {
  role: "dean" | "hod" | "teacher";
  facultyId?: string | null;
  departmentIds?: string[] | null;
  pernr?: string | null;
};

type Body = {
  segment?: string;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
  roleScope?: RoleScopeBody;
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

  const segment = body.segment;
  if (segment !== "yellow" && segment !== "red") {
    return NextResponse.json({ error: "Invalid segment" }, { status: 400 });
  }

  const sessionUser = mapSessionToAppUser(
    session as Parameters<typeof mapSessionToAppUser>[0]
  );
  let user = sessionUser;
  if (sessionUser.role === "superadmin" && body.roleScope) {
    user = {
      ...sessionUser,
      role: body.roleScope.role === "teacher" ? "instructor" : body.roleScope.role,
      faculty_id: body.roleScope.facultyId ?? null,
      department_ids: body.roleScope.departmentIds?.length
        ? body.roleScope.departmentIds
        : null,
      department_id: body.roleScope.departmentIds?.[0] ?? null,
      sap_id: body.roleScope.pernr || sessionUser.sap_id,
    };
  }
  const gpaLevel = segment === "red" ? "critical" : "warning";
  const sapIds = await getSapIdsForGpaAlertSegment(
    user,
    body.masterFilter,
    body.gpaFilters,
    body.attendanceFilters,
    gpaLevel
  );

  return NextResponse.json({ sapIds });
}
