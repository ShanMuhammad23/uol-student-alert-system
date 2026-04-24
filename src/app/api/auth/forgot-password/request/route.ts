import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomInt } from "crypto";
import { getStaffResetOtpInfoByEmail, setStaffResetOtpByEmail } from "@/lib/db";
import { sendSmtpMail } from "@/lib/smtp";

const OTP_TTL_MINUTES = 10;

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Please provide a valid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  if (!email || !isEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address to continue." },
      { status: 400 }
    );
  }

  const staff = await getStaffResetOtpInfoByEmail(email);
  if (!staff) {
    return NextResponse.json(
      { error: "Account not found. Please check your email address and try again." },
      { status: 404 }
    );
  }

  if (!staff.password_hash) {
    return NextResponse.json(
      {
        error:
          "This account does not have a password set. Please sign in with Google or contact support.",
      },
      { status: 400 }
    );
  }

  const otp = String(randomInt(100000, 1000000));
  const otpHash = await hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await setStaffResetOtpByEmail(staff.email, otpHash, expiresAt);

  try {
    await sendSmtpMail({
      to: staff.email,
      subject: "Password reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <p>Hello ${staff.name || "User"},</p>
          <p>Your password reset OTP is:</p>
          <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
          <p>This OTP will expire in ${OTP_TTL_MINUTES} minutes.</p>
          <p>If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch {
    return NextResponse.json(
      { error: "We couldn't send OTP email right now. Please try again shortly." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "OTP has been sent successfully. Please check your inbox and spam folder.",
  });
}
