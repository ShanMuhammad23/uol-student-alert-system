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

type Body = {
  segment?: string;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
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

  const user = mapSessionToAppUser(
    session as Parameters<typeof mapSessionToAppUser>[0]
  );
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
