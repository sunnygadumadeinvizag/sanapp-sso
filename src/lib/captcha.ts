import { SignJWT, jwtVerify } from "jose";

/**
 * Simple server-side math captcha (no external service).
 *
 * The question ("7 + 4 = ?") is rendered as an SVG image, and the answer is
 * carried inside a short-lived signed JWT that the form submits back as a
 * hidden field (login) or JSON body (forgot-password). Because the token is
 * signed with the SSO secret, a bot cannot forge or edit the answer.
 */

const SECRET = new TextEncoder().encode(process.env.SSO_SESSION_SECRET!);
const CAPTCHA_TTL_S = 10 * 60; // 10 minutes (client auto-refreshes at 8 min)
const ISSUER = "iipe-sso-captcha";

export type CaptchaChallenge = {
  /** Signed JWT carrying the answer + expiry. */
  token: string;
  /** Human-readable question, e.g. "7 + 4". */
  question: string;
  /** SVG markup for the image. */
  svg: string;
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function svgFor(a: number, op: string, b: number): string {
  const text = `${a} ${op} ${b} = ?`;
  const rot = random(-6, 6).toFixed(1);
  const colors = ["#1f6feb", "#0f766e", "#7c3aed", "#b45309", "#b91c1c"];
  const color = colors[randomInt(0, colors.length - 1)];
  let noise = "";
  for (let i = 0; i < 4; i++) {
    noise += `<line x1="${random(0, 150).toFixed(1)}" y1="${random(0, 50).toFixed(1)}" x2="${random(0, 150).toFixed(1)}" y2="${random(0, 50).toFixed(1)}" stroke="#94a3b8" stroke-width="1" opacity="0.5"/>`;
  }
  // aria-label keeps the challenge accessible to screen readers.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="50" viewBox="0 0 150 50" ` +
    `role="img" aria-label="Security check: ${text}">` +
    `<rect width="150" height="50" rx="7" fill="#eef2f7"/>` +
    noise +
    `<text x="75" y="34" text-anchor="middle" font-size="22" font-weight="700" ` +
    `font-family="monospace, ui-monospace, SFMono-Regular, Menlo, monospace" ` +
    `fill="${color}" transform="rotate(${rot} 75 25)">${text}</text>` +
    `</svg>`
  );
}

export async function createCaptchaChallenge(): Promise<CaptchaChallenge> {
  const op = Math.random() < 0.5 ? "+" : "−";
  let a = randomInt(5, 19);
  let b = randomInt(2, 9);
  if (op === "−" && a < b) [a, b] = [b, a]; // keep the result non-negative
  const ans = op === "+" ? a + b : a - b;

  const token = await new SignJWT({ ans })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${CAPTCHA_TTL_S}s`)
    .sign(SECRET);

  return { token, question: `${a} ${op} ${b}`, svg: svgFor(a, op, b) };
}

export async function verifyCaptcha(token: string, answer: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
    const expected = payload.ans;
    if (typeof expected !== "number") return false;
    return String(expected) === answer.trim();
  } catch {
    return false;
  }
}
