import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Ends the central SSO session.
 * Supports ?post_logout_redirect_uri=<app page> so a user is returned to the
 * page they were on — the URI is only honoured if its origin belongs to a
 * registered OIDC client (no open redirects).
 */
export async function GET(request: NextRequest) {
  const post = request.nextUrl.searchParams.get("post_logout_redirect_uri");
  let target: URL | null = null;

  if (post) {
    try {
      const t = new URL(post);
      if (t.pathname.startsWith("/") && !t.pathname.startsWith("//")) {
        const clients = await prisma.oidcClient.findMany({ select: { redirectUris: true } });
        const origins = new Set<string>();
        for (const c of clients) {
          for (const uri of c.redirectUris.split(",")) {
            try {
              origins.add(new URL(uri.trim()).origin);
            } catch {
              /* skip malformed uri */
            }
          }
        }
        if (origins.has(t.origin)) target = t;
      }
    } catch {
      target = null;
    }
  }

  const res = NextResponse.redirect(
    new URL(target ? target.toString() : "/login?loggedOut=1", request.url),
    303
  );
  res.cookies.set("sso_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
