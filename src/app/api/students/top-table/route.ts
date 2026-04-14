import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getStudentListing,
  type ListingRequest,
  type SessionScope,
} from "@/lib/db/student-listing";

type Body = ListingRequest & {
  roleScope?: {
    role: "dean" | "hod" | "teacher";
    facultyId?: string | null;
    departmentIds?: string[] | null;
    pernr?: string | null;
  };
};

function toSessionScope(session: any): SessionScope | null {
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = toSessionScope(session);
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    let effectiveScope: SessionScope = scope;
    if (scope.role === "superadmin" && body?.roleScope) {
      effectiveScope = {
        role: body.roleScope.role === "teacher" ? "instructor" : body.roleScope.role,
        faculty_id: body.roleScope.facultyId ?? null,
        department_ids: body.roleScope.departmentIds?.length
          ? body.roleScope.departmentIds
          : null,
        pernr: body.roleScope.pernr ?? scope.pernr ?? null,
      };
    }
    const scopedRequest: Body =
      effectiveScope.role === "wellbeing"
        ? {
            ...(body ?? {}),
            roleScope: undefined,
            filters: {
              ...(body?.filters ?? {}),
              interventionFilters: ["referred", "resolved"],
            },
          }
        : (body ?? {});
    const result = await getStudentListing(effectiveScope, scopedRequest);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Top table API error:", error);
    return NextResponse.json(
      { error: "Failed to load student listing" },
      { status: 500 }
    );
  }
}
