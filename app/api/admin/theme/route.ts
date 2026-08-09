import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  return key === process.env.SSO_ADMIN_KEY;
}

const MODES = ["light", "dark", "system"];
const HEX = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { mode, primary, accent } = body as {
    mode?: string;
    primary?: string;
    accent?: string;
  };

  if (mode !== undefined && !MODES.includes(mode)) {
    return NextResponse.json(
      { error: "mode must be one of: light, dark, system" },
      { status: 400 }
    );
  }
  if (primary !== undefined && !HEX.test(primary)) {
    return NextResponse.json(
      { error: "primary must be a hex color like #0b5d4f" },
      { status: 400 }
    );
  }
  if (accent !== undefined && !HEX.test(accent)) {
    return NextResponse.json(
      { error: "accent must be a hex color like #d9a441" },
      { status: 400 }
    );
  }

  const updates: Array<{ key: string; value: string }> = [];
  if (mode !== undefined) updates.push({ key: "theme_mode", value: mode });
  if (primary !== undefined) updates.push({ key: "primary_color", value: primary.toLowerCase() });
  if (accent !== undefined) updates.push({ key: "accent_color", value: accent.toLowerCase() });

  for (const u of updates) {
    await prisma.platformSetting.upsert({
      where: { key: u.key },
      update: { value: u.value },
      create: u,
    });
  }

  return NextResponse.json({ ok: true, updated: updates.map((u) => u.key) });
}
