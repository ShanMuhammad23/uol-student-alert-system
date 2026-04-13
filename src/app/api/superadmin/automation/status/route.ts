import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getLastAlertSnapshotUpdateAt,
  isAutomationRunning,
} from "@/lib/automation";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [isRunning, lastUpdateAt] = await Promise.all([
    isAutomationRunning(),
    getLastAlertSnapshotUpdateAt(),
  ]);

  return NextResponse.json({
    isRunning,
    lastUpdateAt,
  });
}

