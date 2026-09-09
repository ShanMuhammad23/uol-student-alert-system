import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getDistinctEnrollmentSemesters,
  type SessionScope,
} from "@/lib/db/student-listing";
import {
  encodeAcademicTermKey,
  formatAcademicTermLabel,
  getCurrentAcademicTerm,
} from "@/lib/academic-term";

type RoleScopeBody = {
  role: "dean" | "hod" | "teacher" | "wellbeing";
  facultyId?: string | null;
  departmentIds?: string[] | null;
  pernr?: string | null;
};

function toSessionScope(session: {
  user?: {
    id?: string;
    role?: string;
    faculty_id?: string | null;
    department_ids?: unknown;
    pernr?: string | null;
  };
}): SessionScope | null {
  const rawRole = session?.user?.role;
  const role =
    rawRole === "wellbeing-head"
      ? "wellbeing-head"
      : rawRole === "wellbeing-counseller"
        ? "wellbeing-counseller"
        : rawRole;
  if (
    role !== "superadmin" &&
    role !== "dean" &&
    role !== "hod" &&
    role !== "instructor" &&
    role !== "wellbeing" &&
    role !== "wellbeing-head" &&
    role !== "wellbeing-counseller"
  ) {
    return null;
  }
  return {
    role,
    staff_id: session?.user?.id ?? null,
    faculty_id: session?.user?.faculty_id ?? null,
    department_ids: Array.isArray(session?.user?.department_ids)
      ? session.user.department_ids
      : null,
    pernr: session?.user?.pernr ?? null,
  };
}

function scopeWithRoleOverride(
  scope: SessionScope,
  roleScope: RoleScopeBody | undefined
): SessionScope {
  if (scope.role !== "superadmin" || !roleScope) return scope;
  return {
    role:
      roleScope.role === "teacher"
        ? "instructor"
        : roleScope.role === "wellbeing"
          ? "wellbeing"
          : roleScope.role,
    faculty_id: roleScope.facultyId ?? null,
    department_ids: roleScope.departmentIds?.length
      ? roleScope.departmentIds
      : null,
    pernr: roleScope.pernr ?? scope.pernr ?? null,
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = toSessionScope(session);
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const role = url.searchParams.get("role")?.trim().toLowerCase();
  const facultyId = url.searchParams.get("facultyId")?.trim() || null;
  const departmentIdsRaw = url.searchParams.get("departmentIds")?.trim();
  const pernr = url.searchParams.get("pernr")?.trim() || null;
  const roleScope: RoleScopeBody | undefined =
    role === "dean" || role === "hod" || role === "teacher" || role === "wellbeing"
      ? {
          role,
          facultyId,
          departmentIds: departmentIdsRaw
            ? departmentIdsRaw.split(",").map((v) => v.trim()).filter(Boolean)
            : null,
          pernr,
        }
      : undefined;

  try {
    const semesters = await getDistinctEnrollmentSemesters(
      scopeWithRoleOverride(scope, roleScope)
    );
    const currentTerm = getCurrentAcademicTerm();
    const currentLabel =
      formatAcademicTermLabel(currentTerm.termYear, currentTerm.termSession) ??
      `${currentTerm.termYear}/${currentTerm.termSession}`;
    return NextResponse.json(
      {
        semesters,
        current: {
          value: encodeAcademicTermKey(currentTerm),
          label: currentLabel,
          termYear: currentTerm.termYear,
          termSession: currentTerm.termSession,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Semesters API error:", error);
    return NextResponse.json(
      { error: "Failed to load semesters" },
      { status: 500 }
    );
  }
}
