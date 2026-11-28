"use client";

import { useState } from "react";
import { apiPath, Footer, getPlatformNav, Header } from "sanapp-common-ui";
import CaptchaBox from "../components/CaptchaBox";
import InstituteBand from "../components/InstituteBand";

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL ?? "http://localhost:3000";
const MAIN_BASE_URL = process.env.NEXT_PUBLIC_MAIN_BASE_URL ?? "http://localhost:3001";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError("Username or email is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiPath("/api/forgot-password"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          captchaToken,
          captchaAnswer,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Request failed");
      }
      if (data.username) {
        setUsername(data.username);
      } else {
        setUsername(cleanUsername);
      }
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
            <h1 className="iipe-auth-title">Forgot password</h1>
            <p className="iipe-auth-subtitle">
              Enter your username or institute email and we will send you a 6-digit OTP to reset it.
            </p>
          </div>

          {error && <div className="iipe-alert danger">{error}</div>}

          {done ? (
            <div>
              <div className="iipe-alert success">
                If an account exists for &quot;{username}&quot;, a 6-digit OTP has been emailed to
                it. It is valid for 10 minutes.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
                <a
                  className="iipe-btn iipe-auth-btn"
                  href={apiPath(`/reset-password?username=${encodeURIComponent(username)}`)}
                >
                  I have my OTP — Continue to Reset Password
                </a>
                <button
                  type="button"
                  className="iipe-btn secondary"
                  style={{ width: "100%", height: 40 }}
                  onClick={() => {
                    setDone(false);
                    setError(null);
                  }}
                >
                  Didn&apos;t receive OTP? Resend OTP
                </button>
              </div>
              <p className="iipe-auth-foot-link">
                <a href={apiPath("/login")}>← Back to sign in</a>
              </p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="iipe-field">
                <label className="iipe-label" htmlFor="fp-username">
                  Username or Email
                </label>
                <input
                  className="iipe-input"
                  id="fp-username"
                  name="username"
                  placeholder="Enter your username or institute email"
                  autoComplete="username"
                  required
                  autoFocus
                  suppressHydrationWarning
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="iipe-field">
                <label className="iipe-label" htmlFor="captcha">
                  Security check
                </label>
                <CaptchaBox
                  answer={captchaAnswer}
                  onAnswer={setCaptchaAnswer}
                  onToken={setCaptchaToken}
                />
              </div>
              <button className="iipe-btn iipe-auth-btn" type="submit" disabled={busy}>
                {busy ? "Sending OTP…" : "Send OTP"}
              </button>
              <p className="iipe-auth-foot-link">
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
