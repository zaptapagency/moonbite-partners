"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { InvoiceView } from "@moonbite/shared";
import { isTerminal, type OrderStatus } from "@moonbite/shared";
import { getInvoice } from "../lib/api";

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

const panel: React.CSSProperties = {
  border: "1px solid #1c2230",
  borderRadius: 12,
  padding: 16,
  background: "#111622",
  marginTop: 16,
};

const subtle = { color: "#9aa4b2" as const };

function StatusBanner({
  tone,
  title,
  children,
}: {
  tone: "success" | "warn" | "danger" | "info";
  title: string;
  children?: React.ReactNode;
}) {
  const colors: Record<string, { fg: string; border: string; bg: string }> = {
    success: { fg: "#4ade80", border: "#1f6f46", bg: "#0f1c16" },
    warn: { fg: "#e6c84a", border: "#6b5c1f", bg: "#1a170c" },
    danger: { fg: "#ff6b6b", border: "#6b2b2b", bg: "#1a1010" },
    info: { fg: "#8ab4ff", border: "#2a3f6b", bg: "#0e1626" },
  };
  const c = colors[tone];
  return (
    <div
      style={{
        border: `1px solid ${c.border}`,
        background: c.bg,
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
      }}
    >
      <h2 style={{ margin: 0, color: c.fg, fontSize: 20 }}>{title}</h2>
      {children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

function OrderId({ orderId }: { orderId: string }) {
  return (
    <div style={{ ...subtle, fontSize: 13, marginTop: 14 }}>
      Order reference{" "}
      <code style={{ color: "#e6e8ec", wordBreak: "break-all" }}>{orderId}</code>
    </div>
  );
}

/**
 * Live order/invoice view shared by the checkout flow and the shareable
 * `/orders/[id]` status link. Polls `getInvoice` (mirrors the checkout
 * pattern) and stops once the order reaches a terminal state.
 */
export default function OrderStatusView({ orderId }: { orderId: string }) {
  const [inv, setInv] = useState<InvoiceView | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
      <div style={{ maxWidth: 480 }}>
        <p style={{ color: "#ff6b6b" }}>{err}</p>
        <p style={subtle}>
          Double-check the link, or{" "}
          <Link href="/" style={{ color: "#8ab4ff" }}>
            browse products
          </Link>
          .
        </p>
      </div>
    );
  if (!inv) return <p>Loading…</p>;

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
          <p style={{ margin: 0, color: "#cfe8d8" }}>
            Thanks! Your payment confirmed and the merchant issued your
            delivery details (license key, download link, or access — however
            this product is delivered). Check the delivery email you provided at
            checkout.
          </p>
          <OrderId orderId={orderId} />
        </StatusBanner>
        <p style={{ ...subtle, fontSize: 13, marginTop: 16 }}>
          Keep this page link to revisit your order status any time. If you did
          not receive your delivery, contact the merchant with the order
          reference above.
        </p>
        <Link href="/" style={{ color: "#8ab4ff", display: "inline-block", marginTop: 8 }}>
          ← Back to products
        </Link>
      </div>
    );
  }

  if (status === "REFUNDED") {
    return (
      <div style={{ maxWidth: 480 }}>
        <StatusBanner tone="info" title="This order was refunded">
          <p style={{ margin: 0, color: "#cdd9ef" }}>
            The merchant sent your MBITE back to your return address. Refunds
            settle on-chain and may take a few confirmations to appear in your
            wallet.
          </p>
          <OrderId orderId={orderId} />
        </StatusBanner>
        <p style={{ ...subtle, fontSize: 13, marginTop: 16 }}>
          Questions about the refund? Contact the merchant with the order
          reference above.
        </p>
        <Link href="/" style={{ color: "#8ab4ff", display: "inline-block", marginTop: 8 }}>
          ← Back to products
        </Link>
      </div>
    );
  }

  if (status === "EXPIRED") {
    return (
      <div style={{ maxWidth: 480 }}>
        <StatusBanner tone="danger" title="This invoice expired">
          <p style={{ margin: 0, color: "#f1cccc" }}>
            No (sufficient) payment arrived before the quote window closed. No
            charge was made. If you already sent funds, contact the merchant
            with the order reference below.
          </p>
          <OrderId orderId={orderId} />
        </StatusBanner>
        <Link href="/" style={{ color: "#8ab4ff", display: "inline-block", marginTop: 16 }}>
          Start a new order →
        </Link>
      </div>
    );
  }

  if (status === "CANCELLED") {
    return (
      <div style={{ maxWidth: 480 }}>
        <StatusBanner tone="danger" title="This order was cancelled">
          <p style={{ margin: 0, color: "#f1cccc" }}>
            This order was cancelled before payment. No charge was made.
          </p>
          <OrderId orderId={orderId} />
        </StatusBanner>
        <Link href="/" style={{ color: "#8ab4ff", display: "inline-block", marginTop: 16 }}>
          Browse products →
        </Link>
      </div>
    );
  }

  if (status === "UNDERPAID") {
    return (
      <div style={{ maxWidth: 480 }}>
        <StatusBanner tone="warn" title="Payment was too low">
          <p style={{ margin: 0, color: "#ece0b8" }}>
            We received less than the invoice total, so this order can&apos;t be
            fulfilled yet. You can top up by sending the remaining MBITE to the
            same address, or contact the merchant for a refund of what was
            received.
          </p>
        </StatusBanner>
        <div style={panel}>
          <div style={{ fontSize: 12, color: "#7c8699" }}>Invoice total</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{inv.amountMbite} MBITE</div>
          <div style={{ fontSize: 12, color: "#7c8699", marginTop: 12 }}>Send top-up to</div>
          <code style={{ wordBreak: "break-all" }}>{inv.payToAddress}</code>
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
          <p style={{ margin: 0, color: "#cdd9ef" }}>
            {STATUS_COPY[status]} This page updates automatically; it usually
            only takes a moment.
          </p>
          <OrderId orderId={orderId} />
        </StatusBanner>
      </div>
    );
  }

  // Default: awaiting payment / detected — show payment instructions.
  return (
    <div style={{ maxWidth: 480 }}>
      <h1>Pay {inv.amountMbite} MBITE</h1>
      <p style={subtle}>{STATUS_COPY[status] ?? status}</p>

      <div style={{ ...panel, border: "1px solid #2a3344" }}>
        <div style={{ fontSize: 12, color: "#7c8699" }}>Send exactly</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{inv.amountMbite} MBITE</div>
        <div style={{ fontSize: 12, color: "#7c8699", marginTop: 12 }}>To address</div>
        <code style={{ wordBreak: "break-all" }}>{inv.payToAddress}</code>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: "#7c8699" }}>
          Confirmations {inv.confirmations}/{inv.requiredConfirmations}
        </div>
        <div style={{ background: "#1c2230", borderRadius: 6, height: 8, marginTop: 6 }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 6,
              background: "#8ab4ff",
              transition: "width .3s",
            }}
          />
        </div>
      </div>

      <OrderId orderId={orderId} />

      <p style={{ color: "#7c8699", fontSize: 12, marginTop: 16 }}>
        Quote valid until {new Date(inv.expiresAt).toLocaleTimeString()}.
      </p>
    </div>
  );
}
