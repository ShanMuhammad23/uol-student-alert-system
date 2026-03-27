import { NextRequest, NextResponse } from "next/server";
import { buildAlertCountRows, upsertAlertCountRows } from "@/lib/alert-counts";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const cronHeader = req.headers.get("x-cron-secret");
  return cronHeader === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshotDate = new Date().toISOString().slice(0, 10);
    const rows = await buildAlertCountRows(snapshotDate);
    const upserted = await upsertAlertCountRows(rows);

    return NextResponse.json(
      {
        ok: true,
        snapshot_date: snapshotDate,
        upserted_rows: upserted,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/cron/alert-counts:", error);
    return NextResponse.json(
      { error: "Failed to generate and save alert counts" },
      { status: 500 }
    );
  }
}

