"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { createOrder } from "../../../lib/api";

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setErr(null);
    try {
      const { checkoutUrl } = await createOrder(id, email || undefined);
      router.push(checkoutUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h1>Checkout</h1>
      <p style={{ color: "#9aa4b2" }}>
        We&apos;ll generate a one-time MBITE address and wait for your payment to
        confirm, then deliver the product automatically.
      </p>
      <label style={{ display: "block", margin: "16px 0 6px" }}>
        Delivery email (optional)
      </label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #2a3344",
          background: "#0b0e14",
          color: "#e6e8ec",
        }}
      />
      {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}
      <button
        onClick={buy}
        disabled={busy}
        style={{
          marginTop: 16,
          padding: "10px 18px",
          borderRadius: 8,
          border: "none",
          background: busy ? "#2a3344" : "#8ab4ff",
          color: "#0b0e14",
          fontWeight: 700,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Creating invoice…" : "Pay with MBITE"}
      </button>
    </div>
  );
}
