import { NextRequest, NextResponse } from "next/server";
import { getCgpaMapBySapIds } from "@/lib/db/gpa";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { sapIds?: string[] };
    const sapIds = Array.isArray(body?.sapIds) ? body.sapIds : [];
    const cgpaBySapId = await getCgpaMapBySapIds(sapIds);
    return NextResponse.json({ cgpaBySapId }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch GPA records" }, { status: 500 });
  }
}
