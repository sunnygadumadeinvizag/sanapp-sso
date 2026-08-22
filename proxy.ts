import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/authorize",
  "/logout",
  "/api",
  "/_next",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Strip the basePath (/sso, /main, /app1...) before matching routes so the
  // proxy works identically when the app is served behind Apache with a prefix.
  const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "/sso";
  const p =
    BASE_PATH && (pathname === BASE_PATH || pathname.startsWith(BASE_PATH + "/"))
      ? pathname.slice(BASE_PATH.length) || "/"
      : pathname;

  const isPublic = PUBLIC_PATHS.some((pp) => p === pp || p.startsWith(pp + "/")) ||
    p === "/" ||
    p.startsWith("/favicon") ||
    p.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/);

  if (isPublic) {
    return NextResponse.next();
  }

  const session = request.cookies.get("sso_session")?.value;
  if (!session) {
    const loginUrl = new URL(BASE_PATH + "/login", request.nextUrl.origin);
    loginUrl.searchParams.set("returnTo", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
