import { NextResponse } from "next/server";
import { createCaptchaChallenge } from "@/lib/captcha";

/**
 * GET /api/captcha
 * Returns a fresh captcha challenge (signed token + SVG question) for pages
 * rendered as client components (e.g. forgot-password).
 */
export async function GET() {
  const challenge = await createCaptchaChallenge();
  return NextResponse.json(challenge);
}
