import type { NextRequest, NextResponse } from "next/server";

export const APP_SESSION_COOKIES = [
  "main_session",
  "app1_session",
  "app2_session",
  "app3_session",
  "app4_session",
  "app5_session",
  "inv_session",
  "phc_session",
  "wikidocs_session",
] as const;

/**
 * Expire all app-specific session cookies (plus any dynamic `*_session` cookie
 * on the request) on `res`. Used during central logout (with `includeSso: true`)
 * and before setting a fresh `sso_session` at login (`includeSso: false`) so no
 * previous user's app session survives on the same browser origin.
 */
export function clearAppSessionCookies(
  request: NextRequest,
  res: NextResponse,
  options?: { includeSso?: boolean }
) {
  const includeSso = Boolean(options?.includeSso);
  const names = new Set<string>(APP_SESSION_COOKIES);
  for (const c of request.cookies.getAll()) {
    if (c.name.endsWith("_session")) {
      names.add(c.name);
    }
  }
  if (includeSso) {
    names.add("sso_session");
  } else {
    names.delete("sso_session");
  }

  const secure = process.env.COOKIE_SECURE === "true";
  for (const name of names) {
    res.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      secure,
    });
  }
}
