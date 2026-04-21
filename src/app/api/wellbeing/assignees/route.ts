import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { pool } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "wellbeing" && session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!pool) {
    return NextResponse.json({ assignees: [] });
  }
  const res = await pool.query<{
    id: string;
    name: string;
    pernr: string | null;
    email: string;
  }>(
    `SELECT id::text, name, pernr, email
     FROM staff
     WHERE role = 'wellbeing'
     ORDER BY name ASC`
  );
  return NextResponse.json({
    assignees: res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      pernr: r.pernr,
      email: r.email,
    })),
  });
}
