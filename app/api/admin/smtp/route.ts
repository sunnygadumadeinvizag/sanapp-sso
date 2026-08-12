import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  return key === process.env.SSO_ADMIN_KEY;
}

const HOST_RE = /^[a-z0-9.-]+$/i;

/** Public shape: never leaks the password back to the UI. */
function publicShape(s: {
  host: string;
  port: number;
  user: string;
  fromEmail: string;
  password: string;
}) {
  return {
    host: s.host,
    port: s.port,
    user: s.user,
    fromEmail: s.fromEmail,
    // Client only needs to know whether a password is set, not its value.
    hasPassword: Boolean(s.password),
  };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const setting = await prisma.ssoSetting.findUnique({ where: { id: "smtp" } });
  if (!setting) {
    return NextResponse.json({ configured: false, smtp: null });
  }
  return NextResponse.json({ configured: true, smtp: publicShape(setting) });
}

export async function PUT(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const host = String(body.host ?? "").trim();
  const port = Number(body.port);
  const user = String(body.user ?? "").trim();
  const fromEmail = String(body.fromEmail ?? "").trim();
  const password = String(body.password ?? "").trim();

  if (!host || !HOST_RE.test(host)) {
    return NextResponse.json(
      { error: "A valid SMTP host is required (e.g. smtp.gmail.com)" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return NextResponse.json({ error: "Port must be 1–65535" }, { status: 400 });
  }
  if (!user) {
    return NextResponse.json({ error: "SMTP username is required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    return NextResponse.json({ error: "A valid From email address is required" }, { status: 400 });
  }

  // Keep the existing password when the admin leaves the password field blank.
  const existing = await prisma.ssoSetting.findUnique({ where: { id: "smtp" } });
  const finalPassword = password || existing?.password || "";

  if (!finalPassword) {
    return NextResponse.json(
      { error: "SMTP password is required (or leave blank to keep the existing one)" },
      { status: 400 }
    );
  }

  const saved = await prisma.ssoSetting.upsert({
    where: { id: "smtp" },
    update: { host, port, user, password: finalPassword, fromEmail },
    create: { id: "smtp", host, port, user, password: finalPassword, fromEmail },
  });

  return NextResponse.json({
    ok: true,
    smtp: publicShape(saved),
    message: "SMTP settings saved. Emails (OTP, notifications) will use these credentials.",
  });
}
