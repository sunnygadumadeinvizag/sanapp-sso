"use client";

import { useState } from "react";
import { apiPath } from "sanapp-common-ui";
import CaptchaBox from "./CaptchaBox";

/**
 * Client-side login form.
 *
 * Submits with fetch so a failed attempt can show the validation message
 * inline while keeping everything the user typed — username, password and
 * the security-check answer are never cleared. (The captcha token is a
 * stateless 10-minute JWT, so it stays valid across attempts.)
 *
 * The native form action is kept for non-JS fallback: without JavaScript the
 * browser POSTs normally and /api/login redirects with ?error= as before.
 * With JavaScript we preventDefault and add client=fetch so /api/login
 * answers with JSON instead of a redirect.
 *
 * Also shows a Caps Lock warning while typing the password.
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
  const [error, setError] = useState<"captcha" | "credentials" | null>(null);
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
      setError(d.error === "captcha" ? "captcha" : "credentials");
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
            : "Invalid username or password."}
        </div>
      )}
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
          onKeyDown={trackCaps}
          onKeyUp={trackCaps}
          onBlur={() => setCapsOn(false)}
        />
        {capsOn && (
          <div
            style={{
              marginTop: 4,
              fontSize: "0.8rem",
              color: "#b45309",
              fontWeight: 600,
            }}
            role="status"
          >
            ⚠ Caps Lock is ON
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
      <button className="iipe-btn" type="submit" style={{ width: "100%" }} disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
