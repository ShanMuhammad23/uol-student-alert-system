import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import {
  clearStaffResetOtpById,
  getStaffResetOtpInfoByEmail,
  updateStaffPasswordHash,
} from "@/lib/db";

const MIN_PASSWORD_LENGTH = 8;

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  let body: { email?: string; otp?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Please provide a valid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const otp = String(body.otp ?? "").trim();
  const newPassword = String(body.newPassword ?? "");

  if (!email || !isEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: "OTP must be exactly 6 digits." }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` },
      { status: 400 }
    );
  }

  const staff = await getStaffResetOtpInfoByEmail(email);
  if (!staff?.reset_otp_hash || !staff.reset_otp_expires_at) {
    return NextResponse.json(
      { error: "Invalid reset request. Please request a new OTP." },
      { status: 400 }
    );
  }

  if (new Date(staff.reset_otp_expires_at).getTime() < Date.now()) {
    await clearStaffResetOtpById(staff.id);
    return NextResponse.json(
      { error: "Your OTP has expired. Please request a new OTP." },
      { status: 400 }
    );
  }

  const otpValid = await compare(otp, staff.reset_otp_hash);
  if (!otpValid) {
    return NextResponse.json(
      { error: "The OTP you entered is incorrect. Please try again." },
      { status: 400 }
    );
  }

  const passwordHash = await hash(newPassword, 10);
  const updated = await updateStaffPasswordHash(staff.id, passwordHash);
  if (!updated) {
    return NextResponse.json(
      { error: "We could not update your password right now. Please try again." },
      { status: 500 }
    );
  }
  await clearStaffResetOtpById(staff.id);

  return NextResponse.json({
    ok: true,
    message: "Your password has been reset successfully. You can now sign in.",
  });
}
