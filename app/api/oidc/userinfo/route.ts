import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const claims = await verifyAccessToken(token);
  if (!claims) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, username: true, name: true, email: true, role: true, primaryRole: true, createdAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  return NextResponse.json({
    sub: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    // The SSO PrimaryRole (STAFF_TEACHING, STUDENT, ...) — used by
    // applications for role-based eligibility. null when not set.
    primaryRole: user.primaryRole ?? null,
    email_verified: true,
  });
}
