import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  return key === process.env.SSO_ADMIN_KEY;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SKIP_KEY = "mail_skip_sending";
const REDIRECT_KEY = "mail_test_redirect";

function parseSkip(v: string | undefined | null) {
  return ["true", "1", "on", "yes"].includes(String(v ?? "").trim().toLowerCase());
}

/** GET — current global email guards (skip sending, test-email redirect). */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [skipRow, redirectRow] = await Promise.all([
    prisma.platformSetting.findUnique({ where: { key: SKIP_KEY } }),
    prisma.platformSetting.findUnique({ where: { key: REDIRECT_KEY } }),
  ]);
  return NextResponse.json({
    skipSending: parseSkip(skipRow?.value),
    testEmail: (redirectRow?.value ?? "").trim(),
  });
}

/**
 * PUT — update the guards.
 *   { skipSending: boolean, testEmail: string }
 * testEmail "" disables redirect; a valid email sends ALL platform mail there.
 * When skipSending is on, nothing is delivered at all (the redirect is kept
 * but ignored until skipping is turned off).
 */
export async function PUT(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const skipSending = body.skipSending === true || body.skipSending === "true" || body.skipSending === "1";
  const testEmail = String(body.testEmail ?? "").trim();

  if (testEmail && !EMAIL_RE.test(testEmail)) {
    return NextResponse.json(
      { error: "Test email must be a valid email address (or empty to disable redirect)" },
      { status: 400 }
    );
  }

  await prisma.platformSetting.upsert({
    where: { key: SKIP_KEY },
    update: { value: skipSending ? "true" : "false" },
    create: { key: SKIP_KEY, value: skipSending ? "true" : "false" },
  });
  await prisma.platformSetting.upsert({
    where: { key: REDIRECT_KEY },
    update: { value: testEmail },
    create: { key: REDIRECT_KEY, value: testEmail },
  });

  return NextResponse.json({
    ok: true,
    skipSending,
    testEmail,
    message: skipSending
      ? "Email sending is now SKIPPED — nobody will receive any emails."
      : testEmail
        ? `All emails will now be delivered to the test inbox ${testEmail} only.`
        : "Emails are delivered to their real recipients.",
  });
}
