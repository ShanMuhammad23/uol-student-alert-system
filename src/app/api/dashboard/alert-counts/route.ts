import { NextResponse } from "next/server";
import { buildAlertCountRows } from "@/lib/alert-counts";

export async function GET() {
  try {
    const snapshotDate = new Date().toISOString().slice(0, 10);
    const rows = await buildAlertCountRows(snapshotDate);

    return NextResponse.json(
      {
        snapshot_date: snapshotDate,
        total_rows: rows.length,
        rows,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/dashboard/alert-counts:", error);
    return NextResponse.json(
      { error: "Failed to build alert counts" },
      { status: 500 }
    );
  }
}

