import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PROFILE_LOCK_KEY } from "@/lib/profilePolicy";

const PRIMARY_ROLES = [
  "STAFF_NON_TEACHING",
  "STAFF_TEACHING",
  "STUDENT",
  "SCHOLAR",
  "GUEST",
];

function authorized(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  return key === process.env.SSO_ADMIN_KEY;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const setting = await prisma.platformSetting.findUnique({
    where: { key: PROFILE_LOCK_KEY },
  });
  const locked = (setting?.value ?? "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
  return NextResponse.json({ locked });
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!Array.isArray(body.locked)) {
    return NextResponse.json(
      { error: "locked must be an array of primary roles" },
      { status: 400 }
    );
  }

  const locked = body.locked
    .map((r) => String(r).trim().toUpperCase())
    .filter((r) => (PRIMARY_ROLES as string[]).includes(r));
  const unique = [...new Set(locked)];

  await prisma.platformSetting.upsert({
    where: { key: PROFILE_LOCK_KEY },
    update: { value: unique.join(",") },
    create: { key: PROFILE_LOCK_KEY, value: unique.join(",") },
  });

  return NextResponse.json({ locked: unique });
}
