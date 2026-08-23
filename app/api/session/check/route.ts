import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionJwt } from "@/lib/crypto";

/**
 * POST { client_id, client_secret, ssoSession }
 *
 * Client applications call this (server-to-server, authenticated with their
 * OIDC client credentials) to ask the SSO "is this user's central session
 * still valid?" — this is what makes logout propagate across every app and tab.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { client_id, client_secret, ssoSession } = body as {
    client_id?: string;
    client_secret?: string;
    ssoSession?: string;
  };

  if (!client_id || !client_secret) {
    return NextResponse.json({ valid: false, error: "missing_credentials" }, { status: 401 });
  }

  const client = await prisma.oidcClient.findUnique({ where: { clientId: client_id } });
  if (!client || client.clientSecret !== client_secret) {
    return NextResponse.json({ valid: false, error: "invalid_client" }, { status: 401 });
  }

  const user = ssoSession ? await verifySessionJwt(ssoSession) : null;
  if (!user) {
    return NextResponse.json({ valid: false });
  }

  const setting = await prisma.platformSetting.findUnique({
    where: { key: "session_idle_minutes" },
  });
  const idleTimeoutMinutes = setting ? parseInt(setting.value, 10) || 30 : 30;

  return NextResponse.json({
    valid: true,
    sub: user.sub,
    username: user.username,
    name: user.name,
    idleTimeoutMinutes,
    idleTimeoutMs: idleTimeoutMinutes * 60 * 1000,
  });
}
