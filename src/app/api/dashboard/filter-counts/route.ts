import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getFilterDropdownCounts,
  type ListingFilters,
  type SessionScope,
} from "@/lib/db/student-listing";
import { WELLBEING_RESOLUTION_OPTIONS } from "@/lib/wellbeing-resolution-options";

function toSessionScope(session: {
  user?: {
    role?: string;
    faculty_id?: string | null;
    department_ids?: unknown;
    pernr?: string | null;
  };
}): SessionScope | null {
  const role = session?.user?.role;
  if (
    role !== "superadmin" &&
    role !== "dean" &&
    role !== "hod" &&
    role !== "instructor" &&
    role !== "wellbeing"
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

type RoleScopeBody = {
  role: "dean" | "hod" | "teacher";
  facultyId?: string | null;
  departmentIds?: string[] | null;
  pernr?: string | null;
};

function scopeWithRoleOverride(
  scope: SessionScope,
  roleScope: RoleScopeBody | undefined
): SessionScope {
  if (scope.role !== "superadmin" || !roleScope) return scope;
  return {
    role: roleScope.role === "teacher" ? "instructor" : roleScope.role,
    faculty_id: roleScope.facultyId ?? null,
    department_ids: roleScope.departmentIds?.length ? roleScope.departmentIds : null,
    pernr: roleScope.pernr ?? scope.pernr ?? null,
  };
}

function emptyCounts() {
  return {
    gpa: { all: 0, red: 0, yellow: 0, good: 0 },
    attendance: { all: 0, red: 0, yellow: 0, good: 0 },
    intervention: {
      all: 0,
      not_started: 0,
      initiated: 0,
      in_progress: 0,
      referred: 0,
      resolved: 0,
      no_action_required: 0,
    },
    wellbeingAll: 0,
    wellbeing: WELLBEING_RESOLUTION_OPTIONS.map(() => 0),
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = toSessionScope(session);
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let filters: ListingFilters = {};
  let roleScope: RoleScopeBody | undefined;
  try {
    const body = (await req.json()) as {
      filters?: ListingFilters;
      roleScope?: RoleScopeBody;
    };
    filters = body?.filters ?? {};
    roleScope = body?.roleScope;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const effectiveScope = scopeWithRoleOverride(scope, roleScope);
    const counts = await getFilterDropdownCounts(effectiveScope, filters);
    return NextResponse.json(counts ?? emptyCounts(), { status: 200 });
  } catch (error) {
    console.error("filter-counts API error:", error);
    return NextResponse.json(emptyCounts(), { status: 200 });
  }
}
