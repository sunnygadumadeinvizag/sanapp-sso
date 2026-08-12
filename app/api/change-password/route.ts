import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifySessionJwt } from "@/lib/crypto";

const MIN_PASSWORD = 8;

export async function POST(request: NextRequest) {
  const store = await cookies();
  const session = store.get("sso_session")?.value ?? "";
  const claims = await verifySessionJwt(session);
  if (!claims) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  if (!user.isActive) {
    return NextResponse.json({ error: "This account is deactivated" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const current = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");
  const confirm = String(body.confirmPassword ?? "");

  if (!current) {
    return NextResponse.json({ error: "Enter your current password" }, { status: 400 });
  }
  const ok = await compare(current, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  if (next.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_PASSWORD} characters` },
      { status: 400 }
    );
  }
  if (next !== confirm) {
    return NextResponse.json({ error: "New passwords do not match" }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: "New password must be different from the current one" }, { status: 400 });
  }

  const passwordHash = await hash(next, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true, message: "Password changed successfully." });
}
