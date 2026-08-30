import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  mode: "system", // light | dark | system
  primary: "#0b5d4f",
  accent: "#d9a441",
} as const;

/**
 * Public platform theme settings. Used by every application's header to
 * know the admin-configured default mode and brand colors (users can
 * still override the mode for themselves via the header toggle).
 */
export async function GET() {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: ["theme_mode", "primary_color", "accent_color", "account_display_disabled"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return NextResponse.json({
    mode: (map.get("theme_mode") as string | undefined) ?? DEFAULTS.mode,
    primary: map.get("primary_color") ?? DEFAULTS.primary,
    accent: map.get("accent_color") ?? DEFAULTS.accent,
    accountDisplayDisabled: map.get("account_display_disabled") === "true" || map.get("account_display_disabled") === "1",
  });
}
