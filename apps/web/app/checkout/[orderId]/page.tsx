"use client";

import { use, useEffect, useState } from "react";
import type { InvoiceView } from "@moonbite/shared";
import { getInvoice } from "../../../lib/api";

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

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [inv, setInv] = useState<InvoiceView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const data = await getInvoice(orderId);
        if (alive) setInv(data);
      } catch {
        if (alive) setErr("Could not load invoice.");
      }
    };
    void poll();
    const t = setInterval(poll, 4000); // mirrors ~2min blocks loosely
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [orderId]);

  if (err) return <p style={{ color: "#ff6b6b" }}>{err}</p>;
  if (!inv) return <p>Loading…</p>;

  const pct = Math.min(
    100,
    Math.round((inv.confirmations / inv.requiredConfirmations) * 100),
  );

  return (
    <div style={{ maxWidth: 480 }}>
      <h1>Pay {inv.amountMbite} MBITE</h1>
      <p style={{ color: "#9aa4b2" }}>{STATUS_COPY[inv.status] ?? inv.status}</p>

      <div
        style={{
          border: "1px solid #2a3344",
          borderRadius: 12,
          padding: 16,
          background: "#111622",
          marginTop: 16,
        }}
      >
        <div style={{ fontSize: 12, color: "#7c8699" }}>Send exactly</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{inv.amountMbite} MBITE</div>
        <div style={{ fontSize: 12, color: "#7c8699", marginTop: 12 }}>To address</div>
        <code style={{ wordBreak: "break-all" }}>{inv.payToAddress}</code>
        {/* TODO: render a QR of a mbite: URI here. */}
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

      <p style={{ color: "#7c8699", fontSize: 12, marginTop: 16 }}>
        Quote valid until {new Date(inv.expiresAt).toLocaleTimeString()}.
      </p>
    </div>
  );
}
