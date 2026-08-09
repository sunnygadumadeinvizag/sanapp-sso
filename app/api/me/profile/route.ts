import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionJwt } from "@/lib/crypto";
import { getLockedProfileRoles, profileLockReason } from "@/lib/profilePolicy";

// Users may update their contact/preference fields. Identity fields (username,
// primary role, department, roll/employee number, gender, PH category) are
// managed by the Super Admin.
const EDITABLE_FIELDS = [
  "name",
  "email",
  "phone",
  "designation",
  "nonInstituteEmail",
  "emergencyPhone",
] as const;

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

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, string | null> = {};

  for (const field of EDITABLE_FIELDS) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "string") {
      return NextResponse.json(
        { error: `${field} must be a string` },
        { status: 400 }
      );
    }
    const value = body[field].trim();
    data[field] = value.length > 0 ? value : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      {
        error:
          "Nothing to update — provide name, email, phone, designation, nonInstituteEmail or emergencyPhone",
      },
      { status: 400 }
    );
  }

  if (data.name === "") {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }
  for (const field of ["email", "nonInstituteEmail"] as const) {
    if (
      data[field] &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[field] as string)
    ) {
      return NextResponse.json(
        { error: `Please enter a valid ${field === "email" ? "email" : "non-institute email"} address (or leave it blank)` },
        { status: 400 }
      );
    }
  }

  const lockedRoles = await getLockedProfileRoles();
  const lockReason = profileLockReason(user, lockedRoles);
  if (lockReason) {
    return NextResponse.json({ error: lockReason }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      phone: true,
      designation: true,
      nonInstituteEmail: true,
      emergencyPhone: true,
      primaryRole: true,
      avatar: true,
      profileLocked: true,
    },
  });

  return NextResponse.json({ user: updated });
}
