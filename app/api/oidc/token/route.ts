import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signIdToken } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const grantType = String(form.get("grant_type") ?? "");
  const code = String(form.get("code") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  const clientSecret = String(form.get("client_secret") ?? "");

  if (grantType !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  const client = await prisma.oidcClient.findUnique({ where: { clientId } });
  if (!client || client.clientSecret !== clientSecret) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  const authCode = await prisma.authCode.findUnique({ where: { code } });
  if (
    !authCode ||
    authCode.usedAt !== null ||
    authCode.expiresAt < new Date() ||
    authCode.clientId !== client.clientId ||
    authCode.redirectUri !== redirectUri
  ) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  await prisma.authCode.update({ where: { code }, data: { usedAt: new Date() } });

  const user = await prisma.user.findUnique({ where: { id: authCode.userId } });
  if (!user) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  const claims = { sub: user.id, username: user.username, name: user.name, email: user.email };

  return NextResponse.json({
    access_token: await signAccessToken(claims, client.clientId),
    token_type: "Bearer",
    expires_in: 3600,
    id_token: await signIdToken(claims, client.clientId),
  });
}
