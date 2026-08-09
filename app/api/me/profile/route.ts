import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionJwt } from "@/lib/crypto";
import { getLockedProfileRoles, profileLockReason } from "@/lib/profilePolicy";

const EDITABLE_FIELDS = ["name", "email", "phone", "designation"] as const;

export async function PATCH(request: NextRequest) {
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

  // Identity fields (username, primary role, department, …) are managed by the
  // Super Admin. Users may only update their contact/preference fields.
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const changes: Record<string, string> = {};

  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "string") {
        return NextResponse.json(
          { error: `${field} must be a string` },
          { status: 400 }
        );
      }
      changes[field] = body[field].trim();
    }
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update — provide name, email, phone or designation" },
      { status: 400 }
    );
  }

  if (typeof changes.name === "string" && changes.name.length === 0) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }
  if (
    typeof changes.email === "string" &&
    changes.email.length > 0 &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)
  ) {
    return NextResponse.json(
      { error: "Please enter a valid email address (or leave it blank)" },
      { status: 400 }
    );
  }

  const lockedRoles = await getLockedProfileRoles();
  const lockReason = profileLockReason(user, lockedRoles);
  if (lockReason) {
    return NextResponse.json({ error: lockReason }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: changes,
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      phone: true,
      designation: true,
      primaryRole: true,
      avatar: true,
      profileLocked: true,
    },
  });

  return NextResponse.json({ user: updated });
}
