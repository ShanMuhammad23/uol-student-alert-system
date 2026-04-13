import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { startEtlAutomationRun } from "@/lib/automation";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await startEtlAutomationRun();
  return NextResponse.json(result, { status: result.started ? 200 : 409 });
}

