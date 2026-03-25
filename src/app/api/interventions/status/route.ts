import { NextResponse } from "next/server";
import {
  getAllLatestInterventionStatuses,
  getLatestInterventionStatusMap,
} from "@/data/intervention-store";

export async function GET() {
  const statusMap = await getAllLatestInterventionStatuses();
  const result: Record<string, string | null> = {};
  for (const [sapId, status] of statusMap.entries()) {
    result[sapId] = status ?? null;
  }
  return NextResponse.json(result, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sapIds?: string[] };
    const sapIds = Array.isArray(body?.sapIds)
      ? body.sapIds.map((s) => String(s).trim()).filter(Boolean)
      : [];
    if (!sapIds.length) return NextResponse.json({}, { status: 200 });

    const uniqueSapIds = Array.from(new Set(sapIds));
    const statusMap = await getLatestInterventionStatusMap(uniqueSapIds);
    const result: Record<string, string | null> = {};
    for (const [sapId, status] of statusMap.entries()) {
      result[sapId] = status ?? null;
    }
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

