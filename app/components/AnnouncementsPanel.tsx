"use client";

import { useEffect, useState } from "react";

export type AnnouncementItem = {
  id: string;
  type: "UPDATE" | "ALERT";
  title: string;
  body: string;
  createdAt: string;
};

const VISIBLE = 3;
const TRUNCATE_AT = 120;

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TypeIcon({ alert }: { alert: boolean }) {
  if (alert) {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function Card({ a, onMore }: { a: AnnouncementItem; onMore: (a: AnnouncementItem) => void }) {
  const isAlert = a.type === "ALERT";
  const needsMore = a.body.length > TRUNCATE_AT;
  return (
    <article className={`iipe-login-ann ${isAlert ? "alert" : ""}`}>
      <div className="iipe-login-ann-row">
        <div className="iipe-ann-type-icon">
          <TypeIcon alert={isAlert} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="iipe-login-ann-head">
            <span className="iipe-ann-kind">{isAlert ? "Alert" : "Update"}</span>
            <span className="iipe-muted">•</span>
            <time className="iipe-ann-date" dateTime={a.createdAt}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {formatDate(a.createdAt)}
            </time>
          </div>
          <h2 className="iipe-login-ann-title" title={a.title}>
            {a.title}
          </h2>
          <p className="iipe-login-ann-body">{a.body}</p>
          {needsMore && (
            <button type="button" className="iipe-login-ann-more" onClick={() => onMore(a)}>
              Read full notice →
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AnnouncementsPanel({
  announcements,
}: {
  announcements: AnnouncementItem[];
}) {
  const [open, setOpen] = useState<AnnouncementItem[] | null>(null);
  const visible = announcements.slice(0, VISIBLE);
  const total = announcements.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <aside className="iipe-updates-card" aria-label="Updates and alerts">
        <div className="iipe-updates-head">
          <div className="iipe-updates-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 11 18-5v12L3 14v-3z" />
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
          </div>
          <div>
            <p className="iipe-updates-kicker">Stay informed</p>
            <h2 className="iipe-updates-title">Updates &amp; Alerts</h2>
          </div>
        </div>
        <p className="iipe-updates-desc">
          Important announcements from the IIPE Intranet Administration appear here.
        </p>

        {total === 0 ? (
          <div className="iipe-ann-empty">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 10 }} aria-hidden="true">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            <div style={{ fontWeight: 600, color: "var(--iipe-text-secondary)" }}>
              No new updates right now
            </div>
            <div style={{ fontSize: "0.82rem", marginTop: 4 }}>
              Please check back here for important notices.
            </div>
          </div>
        ) : (
          <div className="iipe-login-ann-list">
            {visible.map((a) => (
              <Card key={a.id} a={a} onMore={(x) => setOpen([x])} />
            ))}
          </div>
        )}

        <div className="iipe-login-updates-foot">
          <span className="iipe-muted" style={{ fontSize: "0.75rem" }}>
            Indian Institute of Petroleum and Energy · Intranet Portal
          </span>
          {total > VISIBLE && (
            <button
              type="button"
              className="iipe-login-viewall"
              onClick={() => setOpen(announcements)}
            >
              View all ({total})
            </button>
          )}
        </div>
      </aside>

      {open && (
        <div className="iipe-modal-overlay" onClick={() => setOpen(null)}>
          <div
            className="iipe-modal iipe-ann-modal"
            role="dialog"
            aria-modal="true"
            aria-label={open.length === 1 ? "Complete update" : "All updates & alerts"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="iipe-ann-modal-head">
              <h2>{open.length === 1 ? "Announcement" : "All Updates & Alerts"}</h2>
              <button
                type="button"
                className="iipe-ann-modal-close"
                onClick={() => setOpen(null)}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="iipe-ann-modal-list">
              {open.map((a) => (
                <article
                  key={a.id}
                  className={`iipe-login-ann ${a.type === "ALERT" ? "alert" : ""}`}
                >
                  <div className="iipe-login-ann-head">
                    <span className="iipe-ann-kind">
                      {a.type === "ALERT" ? "Alert" : "Update"}
                    </span>
                    <span className="iipe-muted">•</span>
                    <time className="iipe-ann-date" dateTime={a.createdAt}>
                      {formatDate(a.createdAt)}
                    </time>
                  </div>
                  <h3 className="iipe-login-ann-title" style={{ marginBottom: 6 }}>
                    {a.title}
                  </h3>
                  <p className="iipe-ann-modal-full">{a.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
