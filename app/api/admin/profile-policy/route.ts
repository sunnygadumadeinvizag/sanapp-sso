import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_DISPLAY_DISABLED_KEY, PROFILE_LOCK_KEY } from "@/lib/profilePolicy";

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
  const [profileSetting, accountSetting] = await Promise.all([
    prisma.platformSetting.findUnique({ where: { key: PROFILE_LOCK_KEY } }),
    prisma.platformSetting.findUnique({ where: { key: ACCOUNT_DISPLAY_DISABLED_KEY } }),
  ]);
  const locked = (profileSetting?.value ?? "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
  const accountDisplayDisabled =
    accountSetting?.value === "true" || accountSetting?.value === "1";

  return NextResponse.json({ locked, accountDisplayDisabled });
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  let uniqueLocked: string[] | undefined;
  if (Array.isArray(body.locked)) {
    const locked = body.locked
      .map((r) => String(r).trim().toUpperCase())
      .filter((r) => (PRIMARY_ROLES as string[]).includes(r));
    uniqueLocked = [...new Set(locked)];

    await prisma.platformSetting.upsert({
      where: { key: PROFILE_LOCK_KEY },
      update: { value: uniqueLocked.join(",") },
      create: { key: PROFILE_LOCK_KEY, value: uniqueLocked.join(",") },
    });
  }

  let accountDisplayDisabled: boolean | undefined;
  if (typeof body.accountDisplayDisabled === "boolean") {
    accountDisplayDisabled = body.accountDisplayDisabled;
    await prisma.platformSetting.upsert({
      where: { key: ACCOUNT_DISPLAY_DISABLED_KEY },
      update: { value: accountDisplayDisabled ? "true" : "false" },
      create: { key: ACCOUNT_DISPLAY_DISABLED_KEY, value: accountDisplayDisabled ? "true" : "false" },
    });
  }

  const [profileSetting, accountSetting] = await Promise.all([
    prisma.platformSetting.findUnique({ where: { key: PROFILE_LOCK_KEY } }),
    prisma.platformSetting.findUnique({ where: { key: ACCOUNT_DISPLAY_DISABLED_KEY } }),
  ]);

  const finalLocked = (profileSetting?.value ?? "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
  const finalAccountDisabled =
    accountSetting?.value === "true" || accountSetting?.value === "1";

  return NextResponse.json({
    locked: finalLocked,
    accountDisplayDisabled: finalAccountDisabled,
  });
}
