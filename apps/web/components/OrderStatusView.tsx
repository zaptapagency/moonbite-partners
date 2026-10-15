"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { InvoiceView } from "@moonbite/shared";
import { isTerminal, type OrderStatus } from "@moonbite/shared";
import { getInvoice, getEntitlement, type Entitlement } from "../lib/api";

const STATUS_COPY: Record<string, string> = {
  AWAITING_PAYMENT: "Waiting for your payment…",
  DETECTED: "Payment seen — waiting for confirmations…",
  UNDERPAID: "Amount received is too low. Top up or contact the merchant.",
  OVERPAID: "Overpaid — delivered, credit recorded.",
  PAID: "Confirmed! Delivering your product…",
  FULFILLED: "Done — your product has been delivered. 🎉",
  EXPIRED: "This invoice expired. Start a new order.",
  REFUNDED: "This order was refunded.",
  CANCELLED: "This order was cancelled.",
};

function StatusBanner({
  tone,
  title,
  children,
}: {
  tone: "success" | "warn" | "danger" | "info";
  title: string;
  children?: React.ReactNode;
}) {
  const toneClass: Record<string, string> = {
    success: "banner-success",
    warn: "banner-warn",
    danger: "banner-danger",
    info: "banner-info",
  };
  return (
    <div className={`banner ${toneClass[tone]}`} style={{ marginTop: 16 }}>
      <h2 className="h2" style={{ fontSize: 22 }}>{title}</h2>
      {children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

function OrderId({ orderId }: { orderId: string }) {
  return (
    <div className="muted" style={{ fontSize: 13, marginTop: 14 }}>
      Order reference{" "}
      <code style={{ wordBreak: "break-all", fontWeight: 700 }}>{orderId}</code>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <div className="label">{label}</div>
      <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
        <code
          className="input mono"
          style={{ flex: 1, wordBreak: "break-all" }}
        >
          {value}
        </code>
        <button
          className="btn btn-sm btn-ink"
          onClick={() => {
            try {
              void navigator.clipboard?.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard unavailable */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/** Renders the actual delivered goods from the entitlement payload. */
function DeliveryDetails({ ent }: { ent: Entitlement }) {
  if (ent.key) {
    return <CopyField label="Your license key" value={ent.key} />;
  }
  if (ent.downloadUrl) {
    return (
      <div style={{ marginTop: 12 }}>
        <a href={ent.downloadUrl} className="btn btn-accent">
          Download your files ↓
        </a>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          This link is short-lived — if it expires, reopen this page to get a fresh one.
        </div>
      </div>
    );
  }
  if (ent.access === "granted") {
    return (
      <p style={{ margin: "10px 0 0" }}>
        Your course access has been granted — sign in to the course to start.
      </p>
    );
  }
  if (ent.webhook?.delivered) {
    return (
      <p style={{ margin: "10px 0 0" }}>
        Your purchase was delivered to the seller&apos;s system and will be provisioned automatically.
      </p>
    );
  }
  return null;
}

/**
 * Live order/invoice view shared by the checkout flow and the shareable
 * `/orders/[id]` status link. Polls `getInvoice` (mirrors the checkout
 * pattern) and stops once the order reaches a terminal state.
 */
export default function OrderStatusView({ orderId }: { orderId: string }) {
  const [inv, setInv] = useState<InvoiceView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [entErr, setEntErr] = useState<string | null>(null);

  // Once fulfilled, fetch the actual delivered goods (license key / download /
  // access). The orderId is the bearer capability for this endpoint.
  useEffect(() => {
    if (inv?.status !== "FULFILLED") return;
    let alive = true;
    getEntitlement(orderId)
      .then((e) => alive && setEnt(e))
      .catch(() => alive && setEntErr("Delivery details aren't available yet — refresh in a moment."));
    return () => {
      alive = false;
    };
  }, [inv?.status, orderId]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      try {
        const data = await getInvoice(orderId);
        if (!alive) return;
        setInv(data);
        setErr(null);
        // Stop polling once nothing more can change.
        if (timer && isTerminal(data.status as OrderStatus)) {
          clearInterval(timer);
          timer = null;
        }
      } catch {
        if (alive) setErr("Could not load this order.");
      }
    };
    void poll();
    timer = setInterval(poll, 4000); // mirrors ~2min blocks loosely
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [orderId]);

  if (err && !inv)
    return (
      <div className="stack" style={{ maxWidth: 480 }}>
        <div className="banner banner-danger">
          <strong>{err}</strong>
        </div>
        <p className="muted">
          Double-check the link, or{" "}
          <Link href="/" style={{ fontWeight: 700 }}>
            browse products
          </Link>
          .
        </p>
      </div>
    );
  if (!inv) return <p className="muted">Loading…</p>;

  const pct = Math.min(
    100,
    Math.round((inv.confirmations / inv.requiredConfirmations) * 100),
  );
  const status = inv.status;

  // Terminal / special states get a prominent banner + tailored next steps.
  if (status === "FULFILLED") {
    return (
      <div style={{ maxWidth: 480 }}>
        <StatusBanner tone="success" title="Your purchase is complete 🎉">
          <p style={{ margin: 0 }}>
            Thanks! Your payment confirmed and your delivery is below. A copy was
            also sent to the email you provided at checkout.
          </p>
          {ent ? (
            <DeliveryDetails ent={ent} />
          ) : entErr ? (
            <p className="muted" style={{ margin: "10px 0 0" }}>{entErr}</p>
          ) : (
            <p className="muted" style={{ margin: "10px 0 0" }}>Loading your delivery…</p>
          )}
          <OrderId orderId={orderId} />
        </StatusBanner>
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          Keep this page link to revisit your order and re-fetch your delivery
          any time. If something looks wrong, contact the merchant with the
          order reference above.
        </p>
        <Link href="/" style={{ fontWeight: 700, display: "inline-block", marginTop: 8 }}>
          ← Back to products
        </Link>
      </div>
    );
  }

  if (status === "REFUNDED") {
    return (
      <div style={{ maxWidth: 480 }}>
        <StatusBanner tone="info" title="This order was refunded">
          <p style={{ margin: 0 }}>
            The merchant sent your MBITE back to your return address. Refunds
            settle on-chain and may take a few confirmations to appear in your
            wallet.
          </p>
          <OrderId orderId={orderId} />
        </StatusBanner>
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          Questions about the refund? Contact the merchant with the order
          reference above.
        </p>
        <Link href="/" style={{ fontWeight: 700, display: "inline-block", marginTop: 8 }}>
          ← Back to products
        </Link>
      </div>
    );
  }

  if (status === "EXPIRED") {
    return (
      <div style={{ maxWidth: 480 }}>
        <StatusBanner tone="danger" title="This invoice expired">
          <p style={{ margin: 0 }}>
            No (sufficient) payment arrived before the quote window closed. No
            charge was made. If you already sent funds, contact the merchant
            with the order reference below.
          </p>
          <OrderId orderId={orderId} />
        </StatusBanner>
        <Link href="/" style={{ fontWeight: 700, display: "inline-block", marginTop: 16 }}>
          Start a new order →
        </Link>
      </div>
    );
  }

  if (status === "CANCELLED") {
    return (
      <div style={{ maxWidth: 480 }}>
        <StatusBanner tone="danger" title="This order was cancelled">
          <p style={{ margin: 0 }}>
            This order was cancelled before payment. No charge was made.
          </p>
          <OrderId orderId={orderId} />
        </StatusBanner>
        <Link href="/" style={{ fontWeight: 700, display: "inline-block", marginTop: 16 }}>
          Browse products →
        </Link>
      </div>
    );
  }

  if (status === "UNDERPAID") {
    return (
      <div style={{ maxWidth: 480 }}>
        <StatusBanner tone="warn" title="Payment was too low">
          <p style={{ margin: 0 }}>
            We received less than the invoice total, so this order can&apos;t be
            fulfilled yet. You can top up by sending the remaining MBITE to the
            same address, or contact the merchant for a refund of what was
            received.
          </p>
        </StatusBanner>
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="muted" style={{ fontSize: 12 }}>Invoice total</div>
          <div className="price" style={{ fontSize: 22 }}>{inv.amountMbite} MBITE</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>Send top-up to</div>
          <code className="mono" style={{ wordBreak: "break-all" }}>{inv.payToAddress}</code>
        </div>
        <OrderId orderId={orderId} />
      </div>
    );
  }

  // Delivering (PAID / OVERPAID): payment confirmed, product on the way.
  if (status === "PAID" || status === "OVERPAID") {
    return (
      <div style={{ maxWidth: 480 }}>
        <StatusBanner tone="info" title="Payment confirmed — delivering your product">
          <p style={{ margin: 0 }}>
            {STATUS_COPY[status]} This page updates automatically; it usually
            only takes a moment.
          </p>
          <OrderId orderId={orderId} />
        </StatusBanner>
      </div>
    );
  }

  // Default: awaiting payment / detected — show payment instructions.
  const detected = status === "DETECTED";
  return (
    <div className="stack" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div style={{ textAlign: "center" }}>
        <span className="pill pill-pink">{detected ? "⏳ Payment seen" : "⚡ Awaiting payment"}</span>
      </div>

      <div className="card card-pad" style={{ boxShadow: "var(--shadow)", padding: "26px" }}>
        <div className="stack" style={{ gap: 18 }}>
          <div style={{ textAlign: "center" }}>
            <div className="eyebrow">Send exactly</div>
            <div className="pay-amount">{inv.amountMbite} MBITE</div>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>
              {STATUS_COPY[status] ?? status}
            </p>
          </div>

          <CopyField label="To this MBITE address" value={inv.payToAddress} />

          <div>
            <div className="spread" style={{ marginBottom: 6 }}>
              <span className="label" style={{ margin: 0 }}>Confirmations</span>
              <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
                {inv.confirmations}/{inv.requiredConfirmations}
              </span>
            </div>
            <div className="progress"><span style={{ width: `${pct}%` }} /></div>
          </div>

          <div className="steps">
            <div className={`step ${detected ? "done" : "active"}`}>Sent</div>
            <div className={`step ${detected ? "active" : ""}`}>Confirming</div>
            <div className="step">Delivered</div>
          </div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12, margin: 0, textAlign: "center" }}>
        This page updates automatically. Quote valid until{" "}
        {new Date(inv.expiresAt).toLocaleTimeString()}.
      </p>
      <div style={{ textAlign: "center" }}>
        <OrderId orderId={orderId} />
      </div>
    </div>
  );
}
