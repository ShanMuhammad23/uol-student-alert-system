import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { assignWellbeingCaseIntervention } from "@/lib/db/wellbeing-head-cases";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "wellbeing-head" && session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { assigneeStaffId?: string } | null;
  const assigneeStaffId = String(body?.assigneeStaffId ?? "").trim();

  if (!id?.trim() || !assigneeStaffId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const updated = await assignWellbeingCaseIntervention(id, assigneeStaffId);
  if (!updated) {
    return NextResponse.json({ error: "Case not found or assignee not supported" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
