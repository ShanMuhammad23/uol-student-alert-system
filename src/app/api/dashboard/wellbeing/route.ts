import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getWellbeingChartData,
  mapSessionToAppUser,
} from "@/app/(home)/dashboard/fetch";
import type {
  AlertDimensionFilter,
  MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";

type Body = {
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

  const user = mapSessionToAppUser(
    session as Parameters<typeof mapSessionToAppUser>[0]
  );

  try {
    const data = await getWellbeingChartData(
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

