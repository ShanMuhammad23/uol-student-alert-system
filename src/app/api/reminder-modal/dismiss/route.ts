import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { dismissStaffReminderModal } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await dismissStaffReminderModal(session.user.id);
  if (!ok) {
    return NextResponse.json({ error: "Unable to dismiss reminder" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
