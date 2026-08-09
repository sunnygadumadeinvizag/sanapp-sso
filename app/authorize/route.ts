import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionJwt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const proto = request.headers.get("x-forwarded-proto") ?? "http";
const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
const publicOrigin = `${proto}://${host}`;
  const url = request.nextUrl;
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const responseType = url.searchParams.get("response_type") ?? "";
  const state = url.searchParams.get("state");

  if (responseType !== "code" || !clientId || !redirectUri) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "response_type=code, client_id and redirect_uri are required" },
      { status: 400 }
    );
  }

  const client = await prisma.oidcClient.findUnique({ where: { clientId } });
  const allowedUris = client?.redirectUris.split(",").map((u) => u.trim()) ?? [];
  if (!client || !client.enabled || !allowedUris.includes(redirectUri)) {
    return NextResponse.json(
      { error: "invalid_client", error_description: "Unknown client or redirect_uri not allowed" },
      { status: 400 }
    );
  }

  // Logged in? If not, send the user to the SSO login screen and come back here.
  const session = request.cookies.get("sso_session")?.value;
  const user = session ? await verifySessionJwt(session) : null;
  if (!user) {
    const loginUrl = new URL(BASE_PATH + "/login", publicOrigin);
    loginUrl.searchParams.set("returnTo", url.pathname + url.search);
    return NextResponse.redirect(loginUrl);
  }

  const code = crypto.randomUUID().replaceAll("-", "");
  await prisma.authCode.create({
    data: {
      code,
      clientId,
      userId: user.sub,
      redirectUri,
      state: state ?? null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  if (state) callback.searchParams.set("state", state);
  return NextResponse.redirect(callback);
}
