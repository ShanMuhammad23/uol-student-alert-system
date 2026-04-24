import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { clearStaffResetOtpById, getStaffResetOtpInfoByEmail } from "@/lib/db";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  let body: { email?: string; otp?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Please provide a valid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const otp = String(body.otp ?? "").trim();

  if (!email || !isEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: "OTP must be exactly 6 digits." }, { status: 400 });
  }

  const staff = await getStaffResetOtpInfoByEmail(email);
  if (!staff?.reset_otp_hash || !staff.reset_otp_expires_at) {
    return NextResponse.json(
      { error: "Invalid OTP. Please request a new OTP and try again." },
      { status: 400 }
    );
  }

  if (new Date(staff.reset_otp_expires_at).getTime() < Date.now()) {
    await clearStaffResetOtpById(staff.id);
    return NextResponse.json(
      { error: "Your OTP has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const valid = await compare(otp, staff.reset_otp_hash);
  if (!valid) {
    return NextResponse.json(
      { error: "The OTP you entered is incorrect. Please try again." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "OTP verified successfully. You can now set a new password.",
  });
}
