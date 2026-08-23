import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendPlainTextEmail } from "@/lib/mailer";
import { verifyCaptcha } from "@/lib/captcha";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp(): string {
  // 6-digit one-time password, zero-padded.
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * POST /api/forgot-password  { username }
 * Sends a 6-digit OTP by email (plain text) so the user can reset their password.
 * The identity is keyed by username (unique) — the email may be shared by others.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";

  // Security check — verified before anything else, so unknown usernames are
  // still protected against automated probing.
  const captchaOk = await verifyCaptcha(
    typeof body.captchaToken === "string" ? body.captchaToken : "",
    typeof body.captchaAnswer === "string" ? body.captchaAnswer : ""
  );
  if (!captchaOk) {
    return NextResponse.json(
      { error: "Security check failed. Please try again." },
      { status: 400 }
    );
  }

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  // Do not reveal whether the username exists; always answer ok.
  if (!user || !user.isActive || !user.email) {
    return NextResponse.json({ ok: true });
  }

  // Invalidate any previously issued, unused OTPs for this user.
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const otp = generateOtp();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      otpHash: await hash(otp, 10),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const text = [
    `IIPE Intranet — password reset`,
    ``,
    `Hello ${user.name},`,
    ``,
    `We received a request to reset the password for your IIPE account "${user.username}".`,
    ``,
    `Your one-time password (OTP) is: ${otp}`,
    ``,
    `This OTP is valid for 10 minutes. If you did not request a password reset, you can safely ignore this email.`,
    ``,
    `Thanks,`,
    `IIPE Intranet Team,`,
    `IIPE Visakhapatnam`,
  ].join("\n");

  try {
    await sendPlainTextEmail(user.email, "IIPE password reset OTP", text);
  } catch (err) {
    console.error("[forgot-password] email send failed:", err);
    return NextResponse.json(
      { error: "Could not send the OTP email. Please contact the administrator." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, username: user.username });
}
