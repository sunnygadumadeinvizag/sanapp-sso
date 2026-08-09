"use client";

import { useRef, useState } from "react";

export type ProfileUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  primaryRole: string;
  avatar: string | null;
  profileLocked: boolean;
};

export function ProfileEditor({
  user,
  ssoBaseUrl,
  lockedReason,
}: {
  user: ProfileUser;
  ssoBaseUrl: string;
  lockedReason: string | null;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [designation, setDesignation] = useState(user.designation ?? "");
  const [avatar, setAvatar] = useState<string | null>(user.avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const locked = Boolean(lockedReason);

  function initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");
  }

  async function uploadAvatar(file: File) {
    setError(null);
    setNotice(null);
    if (file.size > 2 * 1024 * 1024) {
      setError("Image is too large — maximum size is 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/me/avatar", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setAvatar(data.avatar as string);
      setNotice("Profile picture updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/me/avatar", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Remove failed");
      setAvatar(null);
      setNotice("Profile picture removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!name.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          designation: designation.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setNotice("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="iipe-card">
      <div className="iipe-row" style={{ alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>My profile</h2>
        <span className="iipe-spacer" />
        {locked && <span className="iipe-badge danger">Profile locked</span>}
      </div>

      <div className="iipe-row" style={{ alignItems: "center", marginBottom: 18 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--iipe-primary-light)",
            color: "var(--iipe-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "1.4rem",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${ssoBaseUrl}${avatar}?v=${Date.now()}`}
              alt=""
              width={72}
              height={72}
              style={{ objectFit: "cover", width: 72, height: 72 }}
            />
          ) : (
            initials(name) || "?"
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAvatar(f);
              e.target.value = "";
            }}
          />
          <div className="iipe-row" style={{ gap: 8 }}>
            <button
              className="iipe-btn secondary"
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || locked}
            >
              Upload photo
            </button>
            {avatar && (
              <button
                className="iipe-btn ghost"
                type="button"
                onClick={() => void removeAvatar()}
                disabled={busy || locked}
              >
                Remove
              </button>
            )}
          </div>
          <div className="iipe-muted" style={{ marginTop: 6 }}>
            PNG, JPEG, GIF or WebP — max 2 MB.
          </div>
        </div>
      </div>

      {error && <div className="iipe-alert danger">{error}</div>}
      {notice && (
        <div className="iipe-alert success">
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{
              float: "right",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {locked && (
        <div className="iipe-alert" style={{ marginBottom: 14 }}>
          {lockedReason}
        </div>
      )}

      <form onSubmit={save}>
        <div className="iipe-field">
          <label className="iipe-label" htmlFor="pe-name">
            Full name
          </label>
          <input
            id="pe-name"
            className="iipe-input"
            value={name}
            disabled={locked || busy}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="iipe-row" style={{ gap: 12 }}>
          <div className="iipe-field" style={{ flex: 1 }}>
            <label className="iipe-label" htmlFor="pe-email">
              Email
            </label>
            <input
              id="pe-email"
              className="iipe-input"
              type="email"
              value={email}
              disabled={locked || busy}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="may be shared with other users"
            />
          </div>
          <div className="iipe-field" style={{ flex: 1 }}>
            <label className="iipe-label" htmlFor="pe-phone">
              Phone
            </label>
            <input
              id="pe-phone"
              className="iipe-input"
              value={phone}
              disabled={locked || busy}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        <div className="iipe-field">
          <label className="iipe-label" htmlFor="pe-designation">
            Designation
          </label>
          <input
            id="pe-designation"
            className="iipe-input"
            value={designation}
            disabled={locked || busy}
            onChange={(e) => setDesignation(e.target.value)}
          />
        </div>
        <div className="iipe-form-actions">
          <button className="iipe-btn" type="submit" disabled={busy || locked}>
            {busy ? "Saving…" : "Save profile"}
          </button>
          <span className="iipe-muted" style={{ alignSelf: "center" }}>
            Username, primary role and department are managed by the Super Admin.
          </span>
        </div>
      </form>
    </div>
  );
}
