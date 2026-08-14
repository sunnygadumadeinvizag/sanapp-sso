import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { apiPath, Footer, getPlatformNav, Header } from "iipe-common-ui";
import { prisma } from "@/lib/prisma";
import { verifySessionJwt } from "@/lib/crypto";
import { createCaptchaChallenge } from "@/lib/captcha";
import AnnouncementsPanel from "../components/AnnouncementsPanel";

export const metadata: Metadata = { title: "IIPE SSO — Sign in" };
export const dynamic = "force-dynamic";

const SSO_BASE_URL = process.env.SSO_BASE_URL ?? "http://localhost:3000";
const MAIN_BASE_URL = process.env.MAIN_BASE_URL ?? "http://localhost:3001";

type Announcement = {
  id: string;
  type: "UPDATE" | "ALERT";
  title: string;
  body: string;
  createdAt: Date;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string; loggedOut?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const returnTo = params.returnTo ?? "/account";

  // Only allow local paths to avoid open redirects (same rule as /api/login).
  const safeReturn =
    returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/account";

  // Already signed in? Send the user where they were going instead of
  // showing the login form again.
  const store = await cookies();
  const session = store.get("sso_session")?.value ?? "";
  const claims = await verifySessionJwt(session);
  if (claims) {
    redirect(safeReturn);
  }

  // Platform updates & alerts posted by the Super Admin (published only).
  const announcements: Announcement[] = await prisma.announcement.findMany({
    where: { published: true },
    select: { id: true, type: true, title: true, body: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  // Security check rendered on every visit (signed token + SVG question).
  const captcha = await createCaptchaChallenge();

  return (
    <>
      <Header
        appName="SSO"
        navItems={getPlatformNav({
          mainBaseUrl: MAIN_BASE_URL,
          ssoBaseUrl: SSO_BASE_URL,
          signedOut: true,
        })}
      />
      <div className="iipe-login-page">
        <div className="iipe-login-stack">
          {/* Hero: official IIPE logo + institute identity (from iipe.ac.in).
              The Hindi name, address and tagline live in the footer now. */}
          <div className="iipe-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/iipe-logo.png" alt="IIPE logo" className="iipe-hero-logo" />
            <div className="iipe-hero-text">
              <div className="iipe-hero-title">INDIAN INSTITUTE OF PETROLEUM AND ENERGY</div>
              <div className="iipe-hero-native">భారతీయ పెట్రోలియం మరియు శక్తి విజ్ఞాన సంస్థ</div>
            </div>
          </div>

          <div className="iipe-login-grid">
            {/* Left: sign-in form */}
            <div className="iipe-card iipe-login-card">
              <h1 style={{ margin: "0 0 4px", fontSize: "1.3rem" }}>IIPE Central SSO</h1>
              <p className="iipe-muted" style={{ margin: "0 0 18px" }}>
                Sign in once to access all IIPE applications
              </p>

              {params.error === "captcha" && (
                <div className="iipe-alert danger">
                  Security check failed. Please try again.
                </div>
              )}
              {params.error && params.error !== "captcha" && (
                <div className="iipe-alert danger">Invalid username or password.</div>
              )}
              {params.loggedOut && (
                <div className="iipe-alert success">You have been signed out.</div>
              )}
              {params.reset && (
                <div className="iipe-alert success">
                  Your password was reset. Sign in with your new password.
                </div>
              )}

              <form action={apiPath("/api/login")} method="post">
                <input type="hidden" name="returnTo" value={safeReturn} />
                <div className="iipe-field">
                  <label className="iipe-label" htmlFor="username">
                    Username
                  </label>
                  {/* suppressHydrationWarning: browsers/password managers rewrite
                      the autocomplete attribute before React hydrates. */}
                  <input
                    className="iipe-input"
                    id="username"
                    name="username"
                    autoComplete="username"
                    required
                    autoFocus
                    suppressHydrationWarning
                  />
                </div>
                <div className="iipe-field">
                  <label className="iipe-label" htmlFor="password">
                    Password
                  </label>
                  <input
                    className="iipe-input"
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    suppressHydrationWarning
                  />
                </div>
                <div className="iipe-field">
                  <label className="iipe-label" htmlFor="captcha">
                    Security check
                  </label>
                  <div className="iipe-captcha-row">
                    {/* eslint-disable-next-line react/no-danger */}
                    <div
                      className="iipe-captcha"
                      dangerouslySetInnerHTML={{ __html: captcha.svg }}
                    />
                    <input type="hidden" name="captchaToken" value={captcha.token} />
                    <input
                      className="iipe-input"
                      id="captcha"
                      name="captchaAnswer"
                      placeholder="Answer"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      suppressHydrationWarning
                    />
                  </div>
                </div>
                <button className="iipe-btn" type="submit" style={{ width: "100%" }}>
                  Sign in
                </button>
              </form>

              <p style={{ marginTop: 12, marginBottom: 0, textAlign: "center" }}>
                <a href={apiPath("/forgot-password")}>Forgot password?</a>
              </p>

              <p className="iipe-muted" style={{ marginTop: 16, marginBottom: 0 }}>
                Demo accounts: <code>sanyasi</code> / <code>password123</code> ·{" "}
                <code>lakshmi</code> / <code>password123</code> · <code>admin</code> /{" "}
                <code>admin123</code>
              </p>
            </div>

            {/* Right: updates & alerts posted by the sysadmin */}
            <AnnouncementsPanel
              announcements={announcements.map((a) => ({
                ...a,
                createdAt: a.createdAt.toISOString(),
              }))}
            />
          </div>
        </div>
      </div>
      <Footer
        links={[
          { label: "Home", href: "/" },
          { label: "Main Portal", href: MAIN_BASE_URL },
        ]}
      />
    </>
  );
}
