import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { listMissingAttendanceReminderRuns } from "@/lib/db/missing-attendance-reminder-logs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;
  const runs = await listMissingAttendanceReminderRuns(
    Number.isFinite(limit) ? limit : 50
  );
  return NextResponse.json({ runs });
}
