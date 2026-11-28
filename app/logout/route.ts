import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearAppSessionCookies } from "@/lib/cookies";

/**
 * Ends the central SSO session and expires all app session cookies on the
 * shared origin so no stale per-app session survives into a subsequent login.
 */
export async function GET(request: NextRequest) {
  const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "/sso";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const publicOrigin = `${proto}://${host}`;
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
    new URL(target ? target.toString() : BASE_PATH + "/login?loggedOut=1", publicOrigin),
    303
  );
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  clearAppSessionCookies(request, res, { includeSso: true });
  return res;
}
