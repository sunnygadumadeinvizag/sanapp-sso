"use client";

import { useEffect, useState } from "react";
import { apiPath, Footer, getPlatformNav, Header, Logo } from "iipe-common-ui";

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL ?? "http://localhost:3000";
const MAIN_BASE_URL = process.env.NEXT_PUBLIC_MAIN_BASE_URL ?? "http://localhost:3001";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<{ token: string; svg: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiPath("/api/forgot-password"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          captchaToken: captcha?.token ?? "",
          captchaAnswer,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        refreshCaptcha();
        throw new Error(data.error ?? "Request failed");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  // Load a fresh security check when the page opens.
  useEffect(() => {
    let alive = true;
    fetch(apiPath("/api/captcha"))
      .then((r) => r.json())
      .then((d) => alive && setCaptcha(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function refreshCaptcha() {
    setCaptcha(null);
    try {
      const r = await fetch(apiPath("/api/captcha"));
      const d = await r.json();
      setCaptcha(d);
    } catch {
      setError("Could not load the security check. Please reload the page.");
    }
  }

  return (
    <>
      <Header
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
            <h1 style={{ margin: "14px 0 4px", fontSize: "1.3rem" }}>Forgot password</h1>
            <p className="iipe-muted" style={{ margin: 0 }}>
              Enter your username and we will email you a one-time password (OTP) to reset it.
            </p>
          </div>

          {error && <div className="iipe-alert danger">{error}</div>}

          {done ? (
            <div>
              <div className="iipe-alert success">
                If an account exists for &quot;{username}&quot;, a 6-digit OTP has been emailed to
                it. It is valid for 10 minutes.
              </div>
              <a
                className="iipe-btn"
                href={`/reset-password?username=${encodeURIComponent(username)}`}
                style={{ textAlign: "center", display: "block" }}
              >
                I have my OTP — continue
              </a>
              <p
                className="iipe-muted"
                style={{ marginTop: 16, marginBottom: 0, textAlign: "center" }}
              >
                <a href={apiPath("/login")}>← Back to sign in</a>
              </p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="iipe-field">
                <label className="iipe-label" htmlFor="fp-username">
                  Username
                </label>
                {/* suppressHydrationWarning: browsers/password managers rewrite
                    the autocomplete attribute before React hydrates. */}
                <input
                  className="iipe-input"
                  id="fp-username"
                  name="username"
                  autoComplete="username"
                  required
                  autoFocus
                  suppressHydrationWarning
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="iipe-field">
                <label className="iipe-label" htmlFor="fp-captcha">
                  Security check
                </label>
                <div className="iipe-captcha-row">
                  {captcha ? (
                    <>
                      {/* eslint-disable-next-line react/no-danger */}
                      <div
                        className="iipe-captcha"
                        dangerouslySetInnerHTML={{ __html: captcha.svg }}
                      />
                      <button
                        type="button"
                        className="iipe-captcha-refresh"
                        onClick={refreshCaptcha}
                        aria-label="New code"
                        title="New code"
                      >
                        ↻
                      </button>
                    </>
                  ) : (
                    <span className="iipe-muted">Loading security check…</span>
                  )}
                  <input
                    className="iipe-input"
                    id="fp-captcha"
                    name="captchaAnswer"
                    placeholder="Answer"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                  />
                </div>
              </div>
              <button className="iipe-btn" type="submit" disabled={busy} style={{ width: "100%" }}>
                {busy ? "Sending OTP…" : "Send OTP"}
              </button>
              <p
                className="iipe-muted"
                style={{ marginTop: 16, marginBottom: 0, textAlign: "center" }}
              >
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
