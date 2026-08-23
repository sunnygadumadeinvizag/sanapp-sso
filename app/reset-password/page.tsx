"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apiPath, Footer, getPlatformNav, Header, Logo } from "sanapp-common-ui";

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL ?? "http://localhost:3000";
const MAIN_BASE_URL = process.env.NEXT_PUBLIC_MAIN_BASE_URL ?? "http://localhost:3001";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="iipe-center-page"><div className="iipe-card">Loading…</div></div>}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const params = useSearchParams();
  const initialUsername = params.get("username") ?? "";

  const [username, setUsername] = useState(initialUsername);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiPath("/api/reset-password"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, otp, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

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
      <div className="iipe-center-page">
        <div className="iipe-card" style={{ width: 400, maxWidth: "100%" }}>
          <div style={{ marginBottom: 20 }}>
            <Logo showText={false} />
            <h1 style={{ margin: "14px 0 4px", fontSize: "1.3rem" }}>Reset password</h1>
            <p className="iipe-muted" style={{ margin: 0 }}>
              Enter the OTP emailed to you, then choose a new password.
            </p>
          </div>

          {error && <div className="iipe-alert danger">{error}</div>}

          {done ? (
            <div>
              <div className="iipe-alert success">
                Your password has been reset. You can now sign in with your new password.
              </div>
              <a
                className="iipe-btn"
                href={apiPath(`/login?reset=1`)}
                style={{ textAlign: "center", display: "block" }}
              >
                Sign in
              </a>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="iipe-field">
                <label className="iipe-label" htmlFor="rp-username">
                  Username
                </label>
                <input
                  className="iipe-input"
                  id="rp-username"
                  required
                  autoFocus={!initialUsername}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="iipe-field">
                <label className="iipe-label" htmlFor="rp-otp">
                  One-time password (OTP)
                </label>
                <input
                  className="iipe-input"
                  id="rp-otp"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
              <div className="iipe-field">
                <label className="iipe-label" htmlFor="rp-password">
                  New password
                </label>
                {/* suppressHydrationWarning: browsers/password managers rewrite
                    the autocomplete attribute before React hydrates. */}
                <input
                  className="iipe-input"
                  id="rp-password"
                  type="password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  suppressHydrationWarning
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="iipe-field">
                <label className="iipe-label" htmlFor="rp-confirm">
                  Confirm new password
                </label>
                <input
                  className="iipe-input"
                  id="rp-confirm"
                  type="password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  suppressHydrationWarning
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <button className="iipe-btn" type="submit" disabled={busy} style={{ width: "100%" }}>
                {busy ? "Resetting…" : "Reset password"}
              </button>
              <p
                className="iipe-muted"
                style={{ marginTop: 16, marginBottom: 0, textAlign: "center" }}
              >
                <a href={apiPath("/forgot-password")}>Resend OTP</a> ·{" "}
                <a href={apiPath("/login")}>← Back to sign in</a>
              </p>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
