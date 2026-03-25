import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { deleteInterventionById } from "@/data/intervention-store";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid intervention id" }, { status: 400 });
  }

  const deleted = await deleteInterventionById(id);
  if (!deleted.studentSapId) {
    return NextResponse.json({ error: "Intervention not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, studentSapId: deleted.studentSapId }, { status: 200 });
}

