"use client";
import { useState } from "react";
import { apiPath } from "iipe-common-ui";

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(apiPath("/api/change-password"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not change the password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice(data.message ?? "Password changed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="iipe-card">
      <h2>Change password</h2>
      <p className="iipe-muted" style={{ marginTop: 0 }}>
        Update the password you use to sign in to the IIPE intranet.
      </p>

      <form onSubmit={submit}>
        <div className="iipe-field">
          <label htmlFor="cp-current" className="iipe-label">Current password</label>
          <input
            id="cp-current"
            className="iipe-input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="iipe-field">
          <label htmlFor="cp-new" className="iipe-label">New password (min 8 characters)</label>
          <input
            id="cp-new"
            className="iipe-input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="iipe-field">
          <label htmlFor="cp-confirm" className="iipe-label">Confirm new password</label>
          <input
            id="cp-confirm"
            className="iipe-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {error && <div className="iipe-alert danger">{error}</div>}
        {notice && <div className="iipe-alert success">{notice}</div>}

        <button className="iipe-btn primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
