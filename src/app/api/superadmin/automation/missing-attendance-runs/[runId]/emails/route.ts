import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { listMissingAttendanceReminderEmailsForRun } from "@/lib/db/missing-attendance-reminder-logs";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId: runIdRaw } = await context.params;
  const runId = Number(runIdRaw);
  if (!Number.isFinite(runId) || runId <= 0) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }

  const emails = await listMissingAttendanceReminderEmailsForRun(runId);
  return NextResponse.json({ emails });
}
