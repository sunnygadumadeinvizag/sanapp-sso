import nodemailer from "nodemailer";
import { prisma } from "./prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Global email guards, set by the super admin from the Main admin console
 * (PlatformSetting table). They apply to EVERY mail this platform sends —
 * both the SSO's own mail (password-reset OTP) and the cross-app relay
 * (/api/admin/mail) that Facilities, Log Request, Inventory, … use.
 *
 *  - mail_skip_sending  "true"  → drop every outgoing mail (log it, send nothing)
 *  - mail_test_redirect an email → deliver every mail to that test inbox only;
 *                                  the subject gains a [TEST] prefix and the
 *                                  original recipients are noted in the body.
 */
async function readMailGuards() {
  const [skipRow, redirectRow] = await Promise.all([
    prisma.platformSetting.findUnique({ where: { key: "mail_skip_sending" } }),
    prisma.platformSetting.findUnique({ where: { key: "mail_test_redirect" } }),
  ]);
  const skip = ["true", "1", "on"].includes((skipRow?.value ?? "").trim().toLowerCase());
  const rawRedirect = (redirectRow?.value ?? "").trim();
  const redirect = rawRedirect && EMAIL_RE.test(rawRedirect) ? rawRedirect : "";
  return { skip, redirect, rawRedirect };
}

/**
 * Send a plain-text email (no HTML) using the SMTP credentials stored in the
 * SsoSetting table (id = "smtp"). Credentials live in the database, not env.
 */
export async function sendPlainTextEmail(
  to: string,
  subject: string,
  text: string
): Promise<void> {
  const guards = await readMailGuards();
  if (guards.skip) {
    console.warn(`mail: SKIPPED (mail_skip_sending is on) — to=${to} subject="${subject}"`);
    return;
  }

  let finalTo = to;
  let finalSubject = subject;
  let finalText = text;
  if (guards.redirect) {
    console.warn(`mail: REDIRECTED to test inbox ${guards.redirect} — original to=${to}`);
    finalTo = guards.redirect;
    finalSubject = `[TEST] ${subject}`;
    finalText = `${text}\n\n----\n[Test-email mode] This mail was redirected from its real recipient(s): ${to}`;
  }

  const setting = await prisma.ssoSetting.findUnique({ where: { id: "smtp" } });
  if (!setting) {
    throw new Error("SMTP settings are not configured in sanapp_sso_db (SsoSetting table)");
  }

  const transporter = nodemailer.createTransport({
    host: setting.host,
    port: setting.port,
    secure: setting.port === 465,
    auth: { user: setting.user, pass: setting.password },
  });

  const fromNameSetting = await prisma.platformSetting.findUnique({
    where: { key: "smtp_from_name" },
  });
  const fromName = fromNameSetting?.value?.trim() || "IIPE Intranet";

  // Extract raw email address if fromEmail includes <...> or extra formatting
  const cleanAddress = setting.fromEmail.includes("<")
    ? setting.fromEmail.replace(/^.*<([^>]+)>.*$/, "$1").trim()
    : setting.fromEmail.trim();

  await transporter.sendMail({
    from: {
      name: fromName,
      address: cleanAddress,
    },
    to: finalTo,
    subject: finalSubject,
    text: finalText, // plain text only — no HTML
  });
}
