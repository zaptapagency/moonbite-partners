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

const STATUS_COLORS: Record<string, string> = {
  FULFILLED: "#4ade80",
  PAID: "#8ab4ff",
  OVERPAID: "#8ab4ff",
  AWAITING_PAYMENT: "#f0b45e",
  DETECTED: "#f0b45e",
  UNDERPAID: "#f0b45e",
  EXPIRED: "#7c8699",
  CANCELLED: "#7c8699",
  REFUNDED: "#c08af9",
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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Your library</h1>
        <button onClick={logout} style={logoutBtn}>
          Log out
        </button>
      </div>
      <p style={{ color: "#9aa4b2" }}>Every product you&apos;ve purchased, newest first.</p>

      {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
      {!items && !error && <p style={{ color: "#9aa4b2" }}>Loading…</p>}
      {items && items.length === 0 && (
        <div style={panel}>
          <p style={{ margin: 0, color: "#9aa4b2" }}>
            No purchases yet. When you buy a product, it will appear here.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items?.map((item) => (
          <div key={item.orderId} style={panel}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18 }}>{item.productTitle}</h2>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: STATUS_COLORS[item.status] ?? "#e6e8ec",
                }}
              >
                {item.status.replace(/_/g, " ")}
              </span>
            </div>
            <p style={{ color: "#9aa4b2", fontSize: 14, margin: "6px 0 0" }}>
              {item.deliverySummary}
            </p>

            {item.entitlement && <AccessDetails ent={item.entitlement} />}

            <div style={{ marginTop: 12, fontSize: 13 }}>
              <Link href={`/orders/${item.orderId}`} style={{ color: "#8ab4ff" }}>
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
    <div style={{ marginTop: 12 }}>
      {ent.key && <CopyField label="License key" value={ent.key} />}
      {ent.downloadUrl && (
        <a href={ent.downloadUrl} style={downloadBtn}>
          Download your files ↓
        </a>
      )}
      {ent.access && (
        <p style={{ fontSize: 14, margin: "8px 0 0" }}>
          Access: <span style={{ color: "#e6e8ec" }}>{ent.access}</span>
        </p>
      )}
      {ent.courseRef && (
        <p style={{ fontSize: 14, margin: "8px 0 0", color: "#9aa4b2" }}>
          Course reference: {ent.courseRef}
        </p>
      )}
      {ent.webhook && (
        <p style={{ fontSize: 14, margin: "8px 0 0", color: "#9aa4b2" }}>
          {ent.webhook.delivered ? "Delivered to the merchant's system." : "Delivery pending."}
        </p>
      )}
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 12, color: "#9aa4b2", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <code
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #2a3344",
            background: "#0b0e14",
            color: "#e6e8ec",
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
          style={copyBtn}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "#111622",
  border: "1px solid #1c2230",
  borderRadius: 12,
  padding: 18,
};
const logoutBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #2a3344",
  background: "transparent",
  color: "#9aa4b2",
  cursor: "pointer",
  fontSize: 13,
};
const downloadBtn: React.CSSProperties = {
  display: "inline-block",
  marginTop: 4,
  padding: "10px 18px",
  borderRadius: 8,
  background: "#8ab4ff",
  color: "#0b0e14",
  fontWeight: 700,
  textDecoration: "none",
};
const copyBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#8ab4ff",
  color: "#0b0e14",
  fontWeight: 700,
  cursor: "pointer",
};
