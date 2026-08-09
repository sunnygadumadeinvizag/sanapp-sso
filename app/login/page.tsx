import type { Metadata } from "next";
import { Logo } from "iipe-common-ui";

export const metadata: Metadata = { title: "IIPE SSO — Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string; loggedOut?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const returnTo = params.returnTo ?? "/account";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="iipe-card" style={{ width: 400, maxWidth: "100%" }}>
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

        <p className="iipe-muted" style={{ marginTop: 16 }}>
          Demo accounts: <code>sanyasi</code> / <code>password123</code> ·{" "}
          <code>lakshmi</code> / <code>password123</code> · <code>admin</code> /{" "}
          <code>admin123</code>
        </p>
      </div>
    </div>
  );
}
