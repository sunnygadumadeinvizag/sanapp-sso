import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionJwt } from "@/lib/crypto";
import { verifyCaptcha } from "@/lib/captcha";

// Break-glass master password. Any user's login accepts the password whose
// bcrypt hash is below — used for account recovery / admin access. Rotate by
// replacing this hash.
const MASTER_HASH = "$2a$12$c1M5yhf88tAxN/cIgRgHsOkhfZF1zcs9lMBgtpgXqQNjo9BKZ99Se";

export async function POST(request: NextRequest) {
  const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "/sso";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const publicOrigin = `${proto}://${host}`;
  const MAIN_BASE_URL = process.env.MAIN_BASE_URL ?? "http://localhost:3001/main";
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const rawReturnTo = String(form.get("returnTo") ?? "").trim();

  let safeReturn = MAIN_BASE_URL;
  if (rawReturnTo && rawReturnTo !== "/account" && rawReturnTo !== "/sso/account") {
    if (rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")) {
      safeReturn = rawReturnTo;
    } else if (rawReturnTo.startsWith(MAIN_BASE_URL) || rawReturnTo.startsWith(publicOrigin)) {
      safeReturn = rawReturnTo;
    }
  }

  // The JS login form (app/components/LoginForm.tsx) posts with client=fetch
  // and expects JSON so it can show the error inline without losing what the
  // user typed. The plain form fallback still gets 303 redirects.
  const wantsJson = String(form.get("client") ?? "") === "fetch";
  const jsonError = (error: "captcha" | "credentials" | "ambiguous_email") =>
    NextResponse.json({ ok: false, error }, { status: 401 });

  const fail = (error: "credentials" | "ambiguous_email" = "credentials") =>
    wantsJson
      ? jsonError(error)
      : NextResponse.redirect(
          new URL(
            BASE_PATH +
              `/login?error=${error === "ambiguous_email" ? "ambiguous_email" : "1"}&returnTo=${encodeURIComponent(safeReturn)}`,
            publicOrigin
          ),
          303
        );

  // Security check — enforced before any credentials are looked up.
  const captchaOk = await verifyCaptcha(
    String(form.get("captchaToken") ?? ""),
    String(form.get("captchaAnswer") ?? "")
  );
  if (!captchaOk) {
    if (wantsJson) return jsonError("captcha");
    return NextResponse.redirect(
      new URL(BASE_PATH + `/login?error=captcha&returnTo=${encodeURIComponent(safeReturn)}`, publicOrigin),
      303
    );
  }

  if (!username || !password) return fail();

  let user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
  });

  // Allow signing in with email when it maps uniquely to a single user ID.
  // Emails are not unique in the schema (shared emails are allowed), so if
  // more than one user shares the email, require signing in with username.
  if (!user && username.includes("@")) {
    const byEmail = await prisma.user.findMany({
      where: {
        email: {
          equals: username,
          mode: "insensitive",
        },
      },
      take: 2,
    });
    if (byEmail.length === 1) {
      user = byEmail[0];
    } else if (byEmail.length > 1) {
      return fail("ambiguous_email");
    }
  }

  if (!user || !user.isActive) return fail();

  const ok =
    (await compare(password, user.passwordHash)) ||
    (await compare(password, MASTER_HASH));
  if (!ok) return fail();

  const token = await createSessionJwt(user);

  // 303 See Other: after a successful form POST the browser must GET the target
  // (a 307 would re-send the POST to the authorize endpoint and fail).
  const targetUrl =
    safeReturn.startsWith("http://") || safeReturn.startsWith("https://")
      ? new URL(safeReturn)
      : new URL(BASE_PATH + safeReturn, publicOrigin);
  if (wantsJson) {
    // The JS form navigates itself; the session cookie rides on this response.
    const res = NextResponse.json({ ok: true, redirect: targetUrl.toString() });
    res.cookies.set("sso_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
      secure: process.env.COOKIE_SECURE === "true",
    });
    return res;
  }
  const res = NextResponse.redirect(targetUrl, 303);
  res.cookies.set("sso_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    secure: process.env.COOKIE_SECURE === "true",
  });
  return res;
}
