import type { Metadata } from "next";
import { Footer, getPlatformNav, Header, Logo } from "iipe-common-ui";
import { prisma } from "@/lib/prisma";

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

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string; loggedOut?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const returnTo = params.returnTo ?? "/account";

  // Platform updates & alerts posted by the Super Admin (published only).
  const announcements: Announcement[] = await prisma.announcement.findMany({
    where: { published: true },
    select: { id: true, type: true, title: true, body: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <>
      <Header
        navItems={getPlatformNav({
          mainBaseUrl: MAIN_BASE_URL,
          ssoBaseUrl: SSO_BASE_URL,
        })}
      />
      <div className="iipe-login-page">
        <div className="iipe-login-grid">
          {/* Left: sign-in form */}
          <div className="iipe-card iipe-login-card">
            <div style={{ marginBottom: 20 }}>
              <Logo showText={false} />
              <h1 style={{ margin: "14px 0 4px", fontSize: "1.3rem" }}>IIPE Central SSO</h1>
              <p className="iipe-muted" style={{ margin: 0 }}>
                Sign in once to access all IIPE applications
              </p>
            </div>

            {params.error && (
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

            <form action="/api/login" method="post">
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="iipe-field">
                <label className="iipe-label" htmlFor="username">
                  Username
                </label>
                <input
                  className="iipe-input"
                  id="username"
                  name="username"
                  autoComplete="username"
                  required
                  autoFocus
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
                />
              </div>
              <button className="iipe-btn" type="submit" style={{ width: "100%" }}>
                Sign in
              </button>
            </form>

            <p style={{ marginTop: 12, marginBottom: 0, textAlign: "center" }}>
              <a href="/forgot-password">Forgot password?</a>
            </p>

            <p className="iipe-muted" style={{ marginTop: 16, marginBottom: 0 }}>
              Demo accounts: <code>sanyasi</code> / <code>password123</code> ·{" "}
              <code>lakshmi</code> / <code>password123</code> · <code>admin</code> /{" "}
              <code>admin123</code>
            </p>
          </div>

          {/* Right: updates & alerts posted by the sysadmin */}
          <aside className="iipe-login-updates">
            <div className="iipe-login-updates-head">
              <h2>Updates &amp; Alerts</h2>
              {announcements.length > 0 && (
                <span className="iipe-muted">{announcements.length} latest</span>
              )}
            </div>

            {announcements.length === 0 ? (
              <p className="iipe-muted" style={{ marginTop: 8 }}>
                No announcements right now.
              </p>
            ) : (
              <div className="iipe-login-ann-list">
                {announcements.map((a) => (
                  <article
                    key={a.id}
                    className={`iipe-login-ann ${a.type === "ALERT" ? "alert" : "update"}`}
                  >
                    <div className="iipe-login-ann-head">
                      <span className={`iipe-badge ${a.type === "ALERT" ? "danger" : ""}`}>
                        {a.type === "ALERT" ? "ALERT" : "UPDATE"}
                      </span>
                      <time className="iipe-muted" dateTime={a.createdAt.toISOString()}>
                        {formatDate(a.createdAt)}
                      </time>
                    </div>
                    <h3>{a.title}</h3>
                    <p>{a.body}</p>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
      <Footer />
    </>
  );
}
