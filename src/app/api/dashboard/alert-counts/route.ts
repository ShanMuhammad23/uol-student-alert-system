import { NextResponse } from "next/server";
import { buildAlertCountRows } from "@/lib/alert-counts";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const facultyIds = Array.from(
      new Set(
        (url.searchParams.get("facultyIds") ?? "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      )
    );
    const facultyId = url.searchParams.get("facultyId")?.trim();
    if (facultyId) facultyIds.push(facultyId);
    if (!facultyIds.length) {
      return NextResponse.json(
        { error: "facultyIds is required. Global alert counts are disabled." },
        { status: 400 }
      );
    }

    const snapshotDate = new Date().toISOString().slice(0, 10);
    const rows = await buildAlertCountRows(snapshotDate, { facultyIds });

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

