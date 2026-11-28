"use client";

import { useState } from "react";
import { apiPath } from "sanapp-common-ui";
import CaptchaBox from "./CaptchaBox";

/**
 * Client-side login form.
 * Preserves typed values on validation error and shows a Caps Lock hint.
 */
export default function LoginForm({
  returnTo,
  initialToken,
  initialSvg,
}: {
  returnTo: string;
  initialToken: string;
  initialSvg: string;
}) {
  const [error, setError] = useState<"captcha" | "credentials" | "ambiguous_email" | null>(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [capsOn, setCapsOn] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = e.currentTarget;
    const username = (f.elements.namedItem("username") as HTMLInputElement).value.trim();
    const password = (f.elements.namedItem("password") as HTMLInputElement).value;
    const captchaToken = (f.elements.namedItem("captchaToken") as HTMLInputElement).value;

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("client", "fetch");
      body.set("username", username);
      body.set("password", password);
      body.set("captchaToken", captchaToken);
      body.set("captchaAnswer", answer);
      body.set("returnTo", returnTo);
      const r = await fetch(apiPath("/api/login"), { method: "POST", body });
      const d = (await r.json()) as { ok: boolean; error?: string; redirect?: string };
      if (d.ok && d.redirect) {
        window.location.href = d.redirect;
        return;
      }
      setError(
        d.error === "captcha"
          ? "captcha"
          : d.error === "ambiguous_email"
            ? "ambiguous_email"
            : "credentials"
      );
    } catch {
      setError("credentials");
    } finally {
      setBusy(false);
    }
  }

  function trackCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    if (typeof e.getModifierState === "function") {
      setCapsOn(e.getModifierState("CapsLock"));
    }
  }

  return (
    <form id="login-form" action={apiPath("/api/login")} method="post" onSubmit={onSubmit}>
      <input type="hidden" name="returnTo" value={returnTo} />
      {error && (
        <div className="iipe-alert danger" role="alert">
          {error === "captcha"
            ? "Security check failed. Please try again."
            : error === "ambiguous_email"
              ? "Multiple accounts share this email address. Please sign in with your username."
              : "Invalid username or password."}
        </div>
      )}
      <div className="iipe-field">
        <label className="iipe-label" htmlFor="username">
          Username or Email
        </label>
        <input
          className="iipe-input"
          id="username"
          name="username"
          placeholder="Enter your username or institute email"
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
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          suppressHydrationWarning
          onKeyDown={trackCaps}
          onKeyUp={trackCaps}
          onBlur={() => setCapsOn(false)}
        />
        {capsOn && (
          <div className="iipe-caps-warn" role="status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Caps Lock is ON
          </div>
        )}
      </div>
      <div className="iipe-field">
        <label className="iipe-label" htmlFor="captcha">
          Security check
        </label>
        <CaptchaBox
          initialToken={initialToken}
          initialSvg={initialSvg}
          answer={answer}
          onAnswer={setAnswer}
        />
      </div>
      <button className="iipe-btn iipe-auth-btn" type="submit" disabled={busy}>
        {busy ? "Signing In…" : "Sign In"}
      </button>
    </form>
  );
}
