import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { compare, hash } from "bcryptjs";
import { authOptions } from "@/lib/auth-config";
import { getStaffById, updateStaffPasswordHash } from "@/lib/db";

const MIN_LEN = 8;

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (newPassword.length < MIN_LEN) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_LEN} characters.` },
      { status: 400 }
    );
  }

  const staff = await getStaffById(session.user.id);
  if (!staff) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!staff.password_hash) {
    return NextResponse.json(
      {
        error:
          "Password is not set for this account (for example, Google sign-in). You cannot change the password here.",
      },
      { status: 400 }
    );
  }

  const ok = await compare(currentPassword, staff.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const nextHash = await hash(newPassword, 10);
  const updated = await updateStaffPasswordHash(session.user.id, nextHash);
  if (!updated) {
    return NextResponse.json({ error: "Could not update password." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
