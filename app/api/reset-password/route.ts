import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/reset-password  { username, otp, password }
 * Verifies the OTP issued for the username, then sets the new password.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !otp || !password) {
    return NextResponse.json(
      { error: "username, otp and password are required" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
  });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const token = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!token) {
    return NextResponse.json(
      { error: "OTP is invalid or has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const matches = await compare(otp, token.otpHash);
  if (!matches) {
    return NextResponse.json(
      { error: "OTP is invalid or has expired. Please request a new one." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(password, 10) },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true, username: user.username });
}
