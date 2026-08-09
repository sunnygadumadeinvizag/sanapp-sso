"use client";

import { useEffect, useState } from "react";

export type AnnouncementItem = {
  id: string;
  type: "UPDATE" | "ALERT";
  title: string;
  body: string;
  createdAt: string;
};

/** How many cards are shown in the side panel before "View all". */
const VISIBLE = 4;
/** Bodies longer than this are clamped on the card, so the card shows "View more". */
const TRUNCATE_AT = 140;

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Card({ a, onMore }: { a: AnnouncementItem; onMore: (a: AnnouncementItem) => void }) {
  const needsMore = a.body.length > TRUNCATE_AT;
  return (
    <article className={`iipe-login-ann ${a.type === "ALERT" ? "alert" : ""}`}>
      <div className="iipe-login-ann-head">
        <span className={`iipe-badge ${a.type === "ALERT" ? "danger" : ""}`}>
          {a.type === "ALERT" ? "ALERT" : "UPDATE"}
        </span>
        <time className="iipe-muted" dateTime={a.createdAt}>
          {formatDate(a.createdAt)}
        </time>
      </div>
      <h3 className="iipe-login-ann-title" title={a.title}>
        {a.title}
      </h3>
      <p className="iipe-login-ann-body">{a.body}</p>
      <div className="iipe-login-ann-foot">
        {needsMore && (
          <button type="button" className="iipe-login-ann-more" onClick={() => onMore(a)}>
            View more…
          </button>
        )}
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

  // Esc closes the modal; lock body scroll while it is open.
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
      <aside className="iipe-login-updates">
        <div className="iipe-login-updates-head">
          <h2>Updates &amp; Alerts</h2>
          {total > 0 && <span className="iipe-muted">{total} latest</span>}
        </div>

        {total === 0 ? (
          <p className="iipe-muted" style={{ marginTop: 8 }}>
            No announcements right now.
          </p>
        ) : (
          <>
            <div className="iipe-login-ann-list">
              {visible.map((a) => (
                <Card key={a.id} a={a} onMore={(x) => setOpen([x])} />
              ))}
            </div>
            {total > VISIBLE && (
              <div className="iipe-login-updates-foot">
                <button
                  type="button"
                  className="iipe-login-viewall"
                  onClick={() => setOpen(announcements)}
                >
                  View all updates ({total})
                </button>
              </div>
            )}
          </>
        )}
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
              <h2>{open.length === 1 ? "Update" : "All updates & alerts"}</h2>
              <button
                type="button"
                className="iipe-ann-modal-close"
                onClick={() => setOpen(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="iipe-ann-modal-list">
              {open.map((a) => (
                <article key={a.id} className={`iipe-login-ann ${a.type === "ALERT" ? "alert" : ""}`}>
                  <div className="iipe-login-ann-head">
                    <span className={`iipe-badge ${a.type === "ALERT" ? "danger" : ""}`}>
                      {a.type === "ALERT" ? "ALERT" : "UPDATE"}
                    </span>
                    <time className="iipe-muted" dateTime={a.createdAt}>
                      {formatDate(a.createdAt)}
                    </time>
                  </div>
                  <h3 className="iipe-ann-modal-title">{a.title}</h3>
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
