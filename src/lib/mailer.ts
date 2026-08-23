import nodemailer from "nodemailer";
import { prisma } from "./prisma";

/**
 * Send a plain-text email (no HTML) using the SMTP credentials stored in the
 * SsoSetting table (id = "smtp"). Credentials live in the database, not env.
 */
export async function sendPlainTextEmail(
  to: string,
  subject: string,
  text: string
): Promise<void> {
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
    to,
    subject,
    text, // plain text only — no HTML
  });
}
