"use client";

import { useEffect, useRef, useState } from "react";
import { apiPath } from "sanapp-common-ui";

/**
 * Client-side security check (math captcha).
 *
 * The signed token has a TTL on the server (see src/lib/captcha.ts). A user
 * who idles on the login page for longer than that TTL would otherwise submit
 * an expired token and get "Security check failed". This component keeps the
 * token fresh:
 *
 *  - every 60s it checks the token's age and re-fetches a new challenge once
 *    it is older than REFRESH_MS (well inside the TTL), and
 *  - it also refreshes when the tab regains focus / visibility, because
 *    background tabs throttle timers (the "came back after an hour" case).
 *
 * The typed answer is cleared whenever the question changes so a stale answer
 * is never submitted. The refresh button (↻) is kept for manual refresh.
 */

// Keep well inside the server TTL (10 min) so a failed fetch still has slack.
const REFRESH_MS = 8 * 60 * 1000;

type Challenge = { token: string; svg: string };

export default function CaptchaBox({
  initialToken,
  initialSvg,
  answer,
  onAnswer,
  onToken,
} : {
  /** Server-rendered challenge (SSR pages). Omit on client-only pages — the
      component fetches a fresh challenge on mount. */
  initialToken?: string;
  initialSvg?: string;
  /** When provided the component is controlled (parent owns the answer). */
  answer?: string;
  onAnswer?: (v: string) => void;
  /** Called whenever a new challenge token is loaded (for fetch-based forms). */
  onToken?: (t: string) => void;
}) {
  const [challenge, setChallenge] = useState<Challenge | null>(
    initialToken && initialSvg ? { token: initialToken, svg: initialSvg } : null
  );
  const [busy, setBusy] = useState(false);
  const [internalAnswer, setInternalAnswer] = useState("");

  const issuedAt = useRef(Date.now());
  const busyRef = useRef(false);
  const challengeRef = useRef(challenge);
  challengeRef.current = challenge;

  const controlled = typeof answer === "string";
  const answerValue = controlled ? (answer as string) : internalAnswer;

  function setAnswerValue(v: string) {
    if (controlled) onAnswer?.(v);
    else setInternalAnswer(v);
  }

  async function refresh() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await fetch(apiPath("/api/captcha"));
      if (r.ok) {
        const d = (await r.json()) as Challenge;
        if (d && d.token && d.svg) {
          challengeRef.current = d;
          issuedAt.current = Date.now();
          setChallenge(d);
          onToken?.(d.token);
          setAnswerValue(""); // question changed — drop any typed answer
        }
      }
    } catch {
      // Network hiccup: keep the current challenge; the TTL has slack.
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // Refresh when the token approaches expiry, and whenever the tab wakes up
  // (background tabs throttle timers, so the 60s check may lag behind).
  useEffect(() => {
    function refreshIfStale() {
      // No challenge yet (client-only pages such as forgot-password): load one.
      if (!challengeRef.current) {
        void refresh();
        return;
      }
      if (Date.now() - issuedAt.current >= REFRESH_MS) void refresh();
    }
    refreshIfStale();
    const id = setInterval(refreshIfStale, 60_000);
    function wake() {
      refreshIfStale();
    }
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return challenge ? (
    <div className="iipe-captcha-row">
      {/* eslint-disable-next-line react/no-danger */}
      <div
        className="iipe-captcha"
        dangerouslySetInnerHTML={{ __html: challenge.svg }}
      />
      <button
        type="button"
        className="iipe-captcha-refresh"
        onClick={() => void refresh()}
        aria-label="New code"
        title="New code"
        disabled={busy}
      >
        ↻
      </button>
      <input type="hidden" name="captchaToken" value={challenge.token} />
      <input
        className="iipe-input"
        id="captcha"
        name="captchaAnswer"
        placeholder="Answer"
        inputMode="numeric"
        autoComplete="off"
        required
        suppressHydrationWarning
        value={answerValue}
        onChange={(e) => setAnswerValue(e.target.value)}
      />
    </div>
  ) : (
    <span className="iipe-muted">Loading security check…</span>
  );
}
