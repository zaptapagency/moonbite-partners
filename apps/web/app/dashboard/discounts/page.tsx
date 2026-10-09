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

  if (authed === null) return <p className="muted">Loading…</p>;
  if (!authed) {
    return (
      <div className="stack" style={{ maxWidth: 420 }}>
        <h1 className="h1">Discount codes</h1>
        <p className="muted">
          You need to sign in first. Head to the{" "}
          <Link href="/dashboard" style={{ fontWeight: 700 }}>
            dashboard
          </Link>{" "}
          to sign in, then come back.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="h1">Discount codes</h1>
        <Link href="/dashboard" className="btn btn-sm">
          ← Dashboard
        </Link>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Share a code with buyers for a percentage or fixed MBITE discount at checkout.
      </p>
      {err && (
        <div className="banner banner-danger">
          <strong>{err}</strong>
        </div>
      )}

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
    <div className="card card-pad stack">
      <h2 className="h2">New code</h2>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 140px" }}>
          <label className="label">Code</label>
          <input
            className="input"
            value={code}
            placeholder="SAVE10"
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label className="label">Type</label>
          <select
            className="select"
            value={kind}
            onChange={(e) => setKind(e.target.value as "percent" | "amount")}
          >
            <option value="percent">Percent off</option>
            <option value="amount">Fixed MBITE off</option>
          </select>
        </div>
        {kind === "percent" ? (
          <div style={{ flex: "1 1 120px" }}>
            <label className="label">Percent (1–100)</label>
            <input
              className="input"
              value={percent}
              placeholder="10"
              inputMode="numeric"
              onChange={(e) => setPercent(e.target.value)}
            />
          </div>
        ) : (
          <div style={{ flex: "1 1 120px" }}>
            <label className="label">Amount (MBITE)</label>
            <input
              className="input"
              value={amount}
              placeholder="0.5"
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 200px" }}>
          <label className="label">Product id (optional — scope to one product)</label>
          <input
            className="input"
            value={productId}
            placeholder="all products"
            onChange={(e) => setProductId(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label className="label">Max redemptions (optional)</label>
          <input
            className="input"
            value={maxRedemptions}
            placeholder="∞"
            inputMode="numeric"
            onChange={(e) => setMaxRedemptions(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label className="label">Expires (optional)</label>
          <input
            className="input"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </div>
      <div>
        <button className="btn btn-accent" onClick={submit} disabled={busy || !code.trim()}>
          {busy ? "Creating…" : "Create code"}
        </button>
      </div>
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
    <div className="card card-pad stack">
      <h2 className="h2">Your codes</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Code</th>
              <th>Value</th>
              <th>Scope</th>
              <th>Redeemed</th>
              <th>Expires</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 800 }} className="mono">{d.code}</td>
                <td>
                  {d.percentOff != null
                    ? `${d.percentOff}%`
                    : d.amountOffMbite != null
                      ? `${fmtMbite(d.amountOffMbite)} MBITE`
                      : "—"}
                </td>
                <td className="muted">
                  {d.product ? d.product.title : "All products"}
                </td>
                <td>
                  {d.redeemedCount}
                  {d.maxRedemptions != null ? ` / ${d.maxRedemptions}` : ""}
                </td>
                <td className="muted">
                  {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : "—"}
                </td>
                <td>
                  {d.active ? (
                    <span className="pill pill-mint">Active</span>
                  ) : (
                    <span className="pill">Inactive</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  {d.active && (
                    <button className="btn btn-sm" onClick={() => deactivate(d.id)}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items === null && (
              <tr>
                <td colSpan={7} className="muted">
                  Loading codes…
                </td>
              </tr>
            )}
            {items !== null && items.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
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
