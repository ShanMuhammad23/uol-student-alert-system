import { NextResponse } from "next/server";
import { getAllLatestInterventionStatuses } from "@/data/intervention-store";

export async function GET() {
  const statusMap = await getAllLatestInterventionStatuses();
  const result: Record<string, string | null> = {};
  for (const [sapId, status] of statusMap.entries()) {
    result[sapId] = status ?? null;
  }
  return NextResponse.json(result, { status: 200 });
}

