import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_IDLE_MINUTES = 30;
const DEFAULT_MAX_HOURS = 8;

/**
 * Public platform session configuration. Used by apps and SessionGuard to
 * know the active idle timeout and max session duration.
 */
export async function GET() {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: ["session_idle_minutes", "session_max_hours"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const idleMinutes = parseInt(map.get("session_idle_minutes") ?? "", 10) || DEFAULT_IDLE_MINUTES;
  const maxHours = parseInt(map.get("session_max_hours") ?? "", 10) || DEFAULT_MAX_HOURS;

  return NextResponse.json({
    idleTimeoutMinutes: idleMinutes,
    idleTimeoutMs: idleMinutes * 60 * 1000,
    maxSessionHours: maxHours,
    maxSessionSeconds: maxHours * 3600,
  });
}
