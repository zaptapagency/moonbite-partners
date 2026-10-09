"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getBuyerToken,
  clearBuyerToken,
  getLibrary,
  type LibraryItem,
  type LibraryEntitlement,
} from "../../lib/buyer";

const STATUS_PILLS: Record<string, string> = {
  FULFILLED: "pill-mint",
  PAID: "pill-sky",
  OVERPAID: "pill-sky",
  AWAITING_PAYMENT: "pill-yellow",
  DETECTED: "pill-yellow",
  UNDERPAID: "pill-yellow",
  EXPIRED: "",
  CANCELLED: "",
  REFUNDED: "pill-pink",
};

export default function LibraryPage() {
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getBuyerToken()) {
      router.replace("/account/login");
      return;
    }
    getLibrary()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load library."));
  }, [router]);

  function logout() {
    clearBuyerToken();
    router.replace("/account/login");
  }

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1 className="h1">Your library</h1>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Every product you&apos;ve purchased, newest first.
          </p>
        </div>
        <button onClick={logout} className="btn btn-sm">
          Log out
        </button>
      </div>

      {error && <div className="banner banner-danger">{error}</div>}
      {!items && !error && <p className="muted">Loading…</p>}
      {items && items.length === 0 && (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            No purchases yet. When you buy a product, it will appear here.
          </p>
        </div>
      )}

      <div className="stack">
        {items?.map((item) => (
          <div key={item.orderId} className="card card-pad stack">
            <div className="spread" style={{ alignItems: "baseline" }}>
              <h2 className="h3">{item.productTitle}</h2>
              <span className={`pill ${STATUS_PILLS[item.status] ?? ""}`}>
                {item.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              {item.deliverySummary}
            </p>

            {item.entitlement && <AccessDetails ent={item.entitlement} />}

            <div style={{ fontSize: 13 }}>
              <Link href={`/orders/${item.orderId}`} style={{ fontWeight: 700 }}>
                View order →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessDetails({ ent }: { ent: LibraryEntitlement }) {
  return (
    <div className="stack">
      {ent.key && <CopyField label="License key" value={ent.key} />}
      {ent.downloadUrl && (
        <div>
          <a href={ent.downloadUrl} className="btn btn-accent">
            Download your files ↓
          </a>
        </div>
      )}
      {ent.access && (
        <div className="banner banner-info" style={{ fontSize: 14 }}>
          Access: <strong>{ent.access}</strong>
        </div>
      )}
      {ent.courseRef && (
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          Course reference: {ent.courseRef}
        </p>
      )}
      {ent.webhook && (
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          {ent.webhook.delivered ? "Delivered to the merchant's system." : "Delivery pending."}
        </p>
      )}
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="label">{label}</div>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <code
          className="mono"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            border: "var(--border)",
            background: "var(--cream)",
            fontSize: 13,
            overflowX: "auto",
          }}
        >
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => undefined,
            );
          }}
          className="btn btn-sm"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
