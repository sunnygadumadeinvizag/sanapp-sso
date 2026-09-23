import { NextRequest, NextResponse } from "next/server";
import { sendPlainTextEmail } from "@/lib/mailer";

/**
 * Internal cross-app mail relay — key-guarded (x-admin-key / ?key=), exactly
 * like every other /api/admin endpoint. Lets applications that do not own SMTP
 * settings (e.g. Facilities booking notifications) send plain-text mail through
 * the SSO, whose SMTP credentials live in sanapp_sso_db (SsoSetting table).
 *
 * POST { to: string | string[], subject: string, text: string, dryRun?: boolean }
 *   dryRun: validate + shape the message but skip SMTP (used in dev/test).
 */
function authorized(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  return key === process.env.SSO_ADMIN_KEY;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rawTo = Array.isArray(body.to) ? body.to : [body.to];
  const to = rawTo.map((t: unknown) => String(t ?? "").trim()).filter(Boolean);
  const subject = String(body.subject ?? "").trim().slice(0, 300);
  const text = String(body.text ?? "");
  const dryRun = body.dryRun === true;

  if (to.length === 0 || to.some((t: string) => !EMAIL_RE.test(t))) {
    return NextResponse.json({ error: "one or more invalid recipient addresses" }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (to.length > 25) {
    return NextResponse.json({ error: "too many recipients (max 25)" }, { status: 400 });
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, to, subject });
  }

  try {
    for (const recipient of to) {
      await sendPlainTextEmail(recipient, subject, text);
    }
    return NextResponse.json({ ok: true, sent: to.length });
  } catch (e) {
    console.error("internal mail relay failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "mail delivery failed" },
      { status: 502 }
    );
  }
}
