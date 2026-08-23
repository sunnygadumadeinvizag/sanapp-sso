import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  return key === process.env.SSO_ADMIN_KEY;
}

const DEFAULT_IDLE_MINUTES = 30;
const DEFAULT_MAX_HOURS = 8;

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: ["session_idle_minutes", "session_max_hours"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const idleMinutes = parseInt(map.get("session_idle_minutes") ?? "", 10) || DEFAULT_IDLE_MINUTES;
  const maxHours = parseInt(map.get("session_max_hours") ?? "", 10) || DEFAULT_MAX_HOURS;

  return NextResponse.json({
    idleTimeoutMinutes: idleMinutes,
    maxSessionHours: maxHours,
  });
}

export async function PUT(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const idleMinutes = Number(body.idleTimeoutMinutes);
  const maxHours = Number(body.maxSessionHours);

  if (!Number.isInteger(idleMinutes) || idleMinutes < 1 || idleMinutes > 1440) {
    return NextResponse.json(
      { error: "Idle timeout must be an integer between 1 and 1440 minutes (24 hours)" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(maxHours) || maxHours < 1 || maxHours > 72) {
    return NextResponse.json(
      { error: "Maximum session length must be an integer between 1 and 72 hours (3 days)" },
      { status: 400 }
    );
  }

  await prisma.platformSetting.upsert({
    where: { key: "session_idle_minutes" },
    update: { value: String(idleMinutes) },
    create: { key: "session_idle_minutes", value: String(idleMinutes) },
  });

  await prisma.platformSetting.upsert({
    where: { key: "session_max_hours" },
    update: { value: String(maxHours) },
    create: { key: "session_max_hours", value: String(maxHours) },
  });

  return NextResponse.json({
    ok: true,
    idleTimeoutMinutes: idleMinutes,
    maxSessionHours: maxHours,
    message: "Session timeout configuration saved successfully.",
  });
}
