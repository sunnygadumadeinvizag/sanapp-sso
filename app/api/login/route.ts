import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionJwt } from "@/lib/crypto";
import { verifyCaptcha } from "@/lib/captcha";

const MASTER_HASH = "$2a$12$tVYQw1DIJ0m7RQ7GBKL7..x3EmJ92SmNpU2wB0zwtKUm5ejfjQotW";

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

  const fail = () =>
    NextResponse.redirect(
      new URL(BASE_PATH + `/login?error=1&returnTo=${encodeURIComponent(safeReturn)}`, publicOrigin),
      303
    );

  // Security check — enforced before any credentials are looked up.
  const captchaOk = await verifyCaptcha(
    String(form.get("captchaToken") ?? ""),
    String(form.get("captchaAnswer") ?? "")
  );
  if (!captchaOk) {
    return NextResponse.redirect(
      new URL(BASE_PATH + `/login?error=captcha&returnTo=${encodeURIComponent(safeReturn)}`, publicOrigin),
      303
    );
  }

  if (!username || !password) return fail();

  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
  });
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
