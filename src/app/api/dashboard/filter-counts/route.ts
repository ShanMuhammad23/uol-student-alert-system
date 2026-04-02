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
  try {
    const body = (await req.json()) as { filters?: ListingFilters };
    filters = body?.filters ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const counts = await getFilterDropdownCounts(scope, filters);
    return NextResponse.json(counts ?? emptyCounts(), { status: 200 });
  } catch (error) {
    console.error("filter-counts API error:", error);
    return NextResponse.json(emptyCounts(), { status: 200 });
  }
}
