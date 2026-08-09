import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionJwt } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const returnTo = String(form.get("returnTo") ?? "/account");

  // Only allow local paths to avoid open redirects.
  const safeReturn =
    returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/account";

  const fail = () =>
    NextResponse.redirect(
      new URL(`/login?error=1&returnTo=${encodeURIComponent(safeReturn)}`, request.url),
      303
    );

  if (!username || !password) return fail();

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) return fail();

  const ok = await compare(password, user.passwordHash);
  if (!ok) return fail();

  const token = await createSessionJwt(user);

  // 303 See Other: after a successful form POST the browser must GET the target
  // (a 307 would re-send the POST to the authorize endpoint and fail).
  const res = NextResponse.redirect(new URL(safeReturn, request.url), 303);
  res.cookies.set("sso_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
