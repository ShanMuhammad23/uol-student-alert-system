import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { updateWellbeingCaseById } from "@/lib/db/wellbeing";
import { pool } from "@/lib/db";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "wellbeing" && session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid case id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        category?: "Counselling" | "Monitoring" | "Flex (Academic)" | "Flex (Financial)";
        wellbeingStatus?: "open" | "closed";
        remarks?: string;
      }
    | null;
  if (!body?.category || !body?.wellbeingStatus) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (session.user.role === "wellbeing" && pool) {
    const ownership = await pool.query<{ student_sap_id: string }>(
      `SELECT student_sap_id
       FROM wellbeing_cases
       WHERE id = $1::uuid
       LIMIT 1`,
      [id]
    );
    const sapId = ownership.rows[0]?.student_sap_id;
    if (!sapId) {
      return NextResponse.json({ error: "Wellbeing case not found" }, { status: 404 });
    }
  }

  const updated = await updateWellbeingCaseById(id, {
    category: body.category,
    wellbeingStatus: body.wellbeingStatus,
    remarks: String(body.remarks ?? ""),
  });
  if (!updated) {
    return NextResponse.json({ error: "Wellbeing case not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, studentSapId: updated.studentSapId }, { status: 200 });
}
