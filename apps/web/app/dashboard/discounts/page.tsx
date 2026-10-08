"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "../../../lib/dashboard";
import {
  createDiscount,
  deactivateDiscount,
  listDiscounts,
  type Discount,
} from "../../../lib/discounts";

// MBITE units (1e8) → trimmed display string.
function fmtMbite(units: string): string {
  try {
    const u = BigInt(units);
    const whole = u / 100_000_000n;
    const frac = (u % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return units;
  }
}

const card: React.CSSProperties = {
  border: "1px solid #1c2230",
  borderRadius: 12,
  padding: 16,
  background: "#111622",
  marginBottom: 16,
};
const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #2a3344",
  background: "#0b0e14",
  color: "#e6e8ec",
  marginTop: 6,
  boxSizing: "border-box",
};
const btn: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "#8ab4ff",
  color: "#0b0e14",
  fontWeight: 700,
  cursor: "pointer",
};
const subtle = { color: "#9aa4b2" as const };

export default function DiscountsPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Discount[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listDiscounts());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load discounts");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    const ok = Boolean(getToken());
    setAuthed(ok);
    if (ok) void refresh();
  }, [refresh]);

  if (authed === null) return <p>Loading…</p>;
  if (!authed) {
    return (
      <div style={{ maxWidth: 420 }}>
        <h1>Discount codes</h1>
        <p style={subtle}>
          You need to sign in first. Head to the{" "}
          <Link href="/dashboard" style={{ color: "#8ab4ff" }}>
            dashboard
          </Link>{" "}
          to sign in, then come back.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginBottom: 0 }}>Discount codes</h1>
        <Link href="/dashboard" style={{ color: "#8ab4ff" }}>
          ← Dashboard
        </Link>
      </div>
      <p style={subtle}>
        Share a code with buyers for a percentage or fixed MBITE discount at checkout.
      </p>
      {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}

      <CreateForm
        onCreated={() => {
          setErr(null);
          void refresh();
        }}
        setErr={setErr}
      />
      <DiscountList items={items} onChange={refresh} setErr={setErr} />
    </div>
  );
}

function CreateForm({
  onCreated,
  setErr,
}: {
  onCreated: () => void;
  setErr: (s: string | null) => void;
}) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [productId, setProductId] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const trimmed = code.trim();
      if (!trimmed) throw new Error("Enter a code");

      const payload: Parameters<typeof createDiscount>[0] = { code: trimmed };
      if (kind === "percent") {
        const p = Number(percent);
        if (!Number.isInteger(p) || p < 1 || p > 100) {
          throw new Error("Percent off must be an integer from 1 to 100");
        }
        payload.percentOff = p;
      } else {
        const coins = parseFloat(amount);
        const units = Math.round(coins * 1e8);
        if (!Number.isFinite(units) || units < 1) {
          throw new Error("Enter a valid MBITE amount off");
        }
        payload.amountOffUnits = units;
      }
      if (productId.trim()) payload.productId = productId.trim();
      if (maxRedemptions.trim()) {
        const m = Number(maxRedemptions);
        if (!Number.isInteger(m) || m < 1) throw new Error("Max redemptions must be ≥ 1");
        payload.maxRedemptions = m;
      }
      if (expiresAt) payload.expiresAt = new Date(expiresAt).toISOString();

      await createDiscount(payload);
      setCode("");
      setPercent("");
      setAmount("");
      setProductId("");
      setMaxRedemptions("");
      setExpiresAt("");
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create discount");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>New code</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: "1 1 140px" }}>
          Code
          <input
            style={input}
            value={code}
            placeholder="SAVE10"
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <label style={{ flex: "1 1 140px" }}>
          Type
          <select
            style={input}
            value={kind}
            onChange={(e) => setKind(e.target.value as "percent" | "amount")}
          >
            <option value="percent">Percent off</option>
            <option value="amount">Fixed MBITE off</option>
          </select>
        </label>
        {kind === "percent" ? (
          <label style={{ flex: "1 1 120px" }}>
            Percent (1–100)
            <input
              style={input}
              value={percent}
              placeholder="10"
              inputMode="numeric"
              onChange={(e) => setPercent(e.target.value)}
            />
          </label>
        ) : (
          <label style={{ flex: "1 1 120px" }}>
            Amount (MBITE)
            <input
              style={input}
              value={amount}
              placeholder="0.5"
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
        <label style={{ flex: "2 1 200px" }}>
          Product id (optional — scope to one product)
          <input
            style={input}
            value={productId}
            placeholder="all products"
            onChange={(e) => setProductId(e.target.value)}
          />
        </label>
        <label style={{ flex: "1 1 120px" }}>
          Max redemptions (optional)
          <input
            style={input}
            value={maxRedemptions}
            placeholder="∞"
            inputMode="numeric"
            onChange={(e) => setMaxRedemptions(e.target.value)}
          />
        </label>
        <label style={{ flex: "1 1 160px" }}>
          Expires (optional)
          <input
            style={input}
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
      </div>
      <button style={{ ...btn, marginTop: 14 }} onClick={submit} disabled={busy || !code.trim()}>
        {busy ? "Creating…" : "Create code"}
      </button>
    </div>
  );
}

function DiscountList({
  items,
  onChange,
  setErr,
}: {
  items: Discount[] | null;
  onChange: () => Promise<void>;
  setErr: (s: string | null) => void;
}) {
  async function deactivate(id: string) {
    setErr(null);
    try {
      await deactivateDiscount(id);
      await onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to deactivate");
    }
  }

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>Your codes</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#7c8699" }}>
              <th style={{ padding: "6px 8px 6px 0" }}>Code</th>
              <th style={{ padding: "6px 8px" }}>Value</th>
              <th style={{ padding: "6px 8px" }}>Scope</th>
              <th style={{ padding: "6px 8px" }}>Redeemed</th>
              <th style={{ padding: "6px 8px" }}>Expires</th>
              <th style={{ padding: "6px 8px" }}>Status</th>
              <th style={{ padding: "6px 8px" }} />
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((d) => (
              <tr key={d.id} style={{ borderTop: "1px solid #1c2230" }}>
                <td style={{ padding: "8px 8px 8px 0", fontWeight: 600 }}>{d.code}</td>
                <td style={{ padding: "8px" }}>
                  {d.percentOff != null
                    ? `${d.percentOff}%`
                    : d.amountOffMbite != null
                      ? `${fmtMbite(d.amountOffMbite)} MBITE`
                      : "—"}
                </td>
                <td style={{ padding: "8px", ...subtle }}>
                  {d.product ? d.product.title : "All products"}
                </td>
                <td style={{ padding: "8px" }}>
                  {d.redeemedCount}
                  {d.maxRedemptions != null ? ` / ${d.maxRedemptions}` : ""}
                </td>
                <td style={{ padding: "8px", ...subtle }}>
                  {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : "—"}
                </td>
                <td style={{ padding: "8px" }}>
                  <span style={{ color: d.active ? "#4ade80" : "#7c8699", fontWeight: 600 }}>
                    {d.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "8px", textAlign: "right" }}>
                  {d.active && (
                    <button
                      style={{ ...btn, background: "#2a3344", color: "#e6e8ec", padding: "6px 12px" }}
                      onClick={() => deactivate(d.id)}
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items === null && (
              <tr>
                <td colSpan={7} style={{ ...subtle, paddingTop: 12 }}>
                  Loading codes…
                </td>
              </tr>
            )}
            {items !== null && items.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...subtle, paddingTop: 12 }}>
                  No discount codes yet — create your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
