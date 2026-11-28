"use client";

import { useEffect, useRef, useState } from "react";
import { apiPath } from "sanapp-common-ui";

const REFRESH_MS = 8 * 60 * 1000;

type Challenge = { token: string; svg: string };

export default function CaptchaBox({
  initialToken,
  initialSvg,
  answer,
  onAnswer,
  onToken,
}: {
  initialToken?: string;
  initialSvg?: string;
  answer?: string;
  onAnswer?: (v: string) => void;
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
          setAnswerValue("");
        }
      }
    } catch {
      // keep current challenge
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    function refreshIfStale() {
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
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
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
