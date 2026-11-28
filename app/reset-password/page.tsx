"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apiPath, Footer, getPlatformNav, Header } from "sanapp-common-ui";
import InstituteBand from "../components/InstituteBand";

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL ?? "http://localhost:3000";
const MAIN_BASE_URL = process.env.NEXT_PUBLIC_MAIN_BASE_URL ?? "http://localhost:3001";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="iipe-center-page">
          <div className="iipe-auth-card iipe-auth-card-center">Loading…</div>
        </div>
      }
    >
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
    const cleanUsername = username.trim();
    const cleanOtp = otp.trim();
    if (!cleanUsername) {
      setError("Username or email is required.");
      return;
    }
    if (!cleanOtp) {
      setError("OTP is required.");
      return;
    }
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
        body: JSON.stringify({ username: cleanUsername, otp: cleanOtp, password }),
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
        signedOut
        navItems={getPlatformNav({
          mainBaseUrl: MAIN_BASE_URL,
          ssoBaseUrl: SSO_BASE_URL,
          signedOut: true,
        })}
      />
      <InstituteBand />
      <main className="iipe-center-page">
        <div className="iipe-auth-card iipe-auth-card-center">
          <div className="iipe-auth-head">
            <div className="iipe-auth-monogram">IIPE</div>
            <h1 className="iipe-auth-title">Reset password</h1>
            <p className="iipe-auth-subtitle">
              Enter the OTP emailed to you, then choose a new password.
            </p>
          </div>

          {error && <div className="iipe-alert danger">{error}</div>}

          {done ? (
            <div>
              <div className="iipe-alert success">
                Your password has been reset. You can now sign in with your new password.
              </div>
              <a className="iipe-btn iipe-auth-btn" href={apiPath(`/login?reset=1`)}>
                Sign In
              </a>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="iipe-field">
                <label className="iipe-label" htmlFor="rp-username">
                  Username or Email
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
              <button className="iipe-btn iipe-auth-btn" type="submit" disabled={busy}>
                {busy ? "Resetting…" : "Reset password"}
              </button>
              <p className="iipe-auth-foot-link">
                <a href={apiPath("/forgot-password")}>Resend OTP</a> ·{" "}
                <a href={apiPath("/login")}>← Back to sign in</a>
              </p>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
