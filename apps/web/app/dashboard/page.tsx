"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearToken,
  createProduct,
  getMyOrders,
  getMyProducts,
  getMyRefunds,
  getProfile,
  getToken,
  login,
  register,
  rejectRefund,
  setXpub,
  submitRefund,
  type DashOrder,
  type DashProduct,
  type DashRefund,
  type Profile,
} from "../../lib/dashboard";

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

const PAGE_SIZE = 10;
const AUTO_REFRESH_MS = 8000;

/** Small "updated Xs ago" indicator for the auto-refreshing panels. */
function RefreshNote({ at }: { at: number | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!at) return null;
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
  const label = secs < 2 ? "just now" : `${secs}s ago`;
  return (
    <span style={{ ...subtle, fontSize: 12 }}>
      auto-refreshing · updated {label}
    </span>
  );
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setProfile(await getProfile());
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }
    load()
      .catch(() => clearToken())
      .finally(() => setBooting(false));
  }, [load]);

  if (booting) return <p>Loading…</p>;
  if (!profile) return <AuthForm onAuthed={load} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginBottom: 0 }}>Merchant dashboard</h1>
        <button
          style={{ ...btn, background: "#2a3344", color: "#e6e8ec" }}
          onClick={() => {
            clearToken();
            setProfile(null);
          }}
        >
          Sign out
        </button>
      </div>
      <p style={subtle}>
        {profile.displayName} · {profile.email} · tier <strong>{profile.tier}</strong> · fee{" "}
        {(profile.feeBps / 100).toFixed(2)}%
      </p>
      <nav style={{ display: "flex", gap: 16, margin: "8px 0 4px" }}>
        <a href="/dashboard/profile" style={{ color: "#8ab4ff", textDecoration: "none" }}>
          Storefront profile →
        </a>
        <a href="/dashboard/discounts" style={{ color: "#8ab4ff", textDecoration: "none" }}>
          Discount codes →
        </a>
      </nav>
      {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}

      <Overview profile={profile} onChange={load} setErr={setErr} />
      <Products setErr={setErr} />
      <Orders setErr={setErr} />
      <Refunds setErr={setErr} />
    </div>
  );
}

function AuthForm({ onAuthed }: { onAuthed: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@moonbite.example");
  const [password, setPassword] = useState("password123");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, displayName);
      await onAuthed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h1>{mode === "login" ? "Merchant sign in" : "Create merchant account"}</h1>
      <div style={card}>
        {mode === "register" && (
          <label>
            Display name
            <input style={input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
        )}
        <label>
          Email
          <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            style={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}
        <button style={{ ...btn, marginTop: 14 }} onClick={submit} disabled={busy}>
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </div>
      <button
        style={{ background: "none", border: "none", color: "#8ab4ff", cursor: "pointer" }}
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
      </button>
    </div>
  );
}

function Overview({
  profile,
  onChange,
  setErr,
}: {
  profile: Profile;
  onChange: () => Promise<void>;
  setErr: (s: string | null) => void;
}) {
  const [xpub, setXpubVal] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await setXpub(xpub);
      await onChange();
      setXpubVal("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>Settlement</h2>
      <p style={subtle}>
        Payouts are non-custodial — orders pay fresh addresses derived from your xpub.{" "}
        {profile.xpubConfigured ? "✅ xpub configured." : "⚠️ No xpub set — you can't receive payments yet."}
      </p>
      <label>
        Settlement xpub
        <input style={input} placeholder="xpub…" value={xpub} onChange={(e) => setXpubVal(e.target.value)} />
      </label>
      <button style={{ ...btn, marginTop: 12 }} onClick={save} disabled={busy || !xpub}>
        {busy ? "Saving…" : profile.xpubConfigured ? "Replace xpub" : "Save xpub"}
      </button>
    </div>
  );
}

function Products({ setErr }: { setErr: (s: string | null) => void }) {
  const [items, setItems] = useState<DashProduct[] | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [method, setMethod] = useState("LICENSE_KEY");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    getMyProducts().then(setItems).catch(() => setItems([]));
  }, []);
  useEffect(refresh, [refresh]);

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      const units = Math.round(parseFloat(price) * 1e8);
      if (!Number.isFinite(units) || units < 1) throw new Error("Enter a valid MBITE price");
      await createProduct({ title, priceMbiteUnits: units, deliveryMethod: method });
      setTitle("");
      setPrice("");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>Products</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: "2 1 160px" }}>
          Title
          <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label style={{ flex: "1 1 100px" }}>
          Price (MBITE)
          <input style={input} value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label style={{ flex: "1 1 140px" }}>
          Delivery
          <select style={input} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="LICENSE_KEY">License key</option>
            <option value="SIGNED_DOWNLOAD">Signed download</option>
            <option value="WEBHOOK">Webhook</option>
            <option value="COURSE_ACCESS">Course access</option>
          </select>
        </label>
        <button style={btn} onClick={add} disabled={busy || !title || !price}>
          Add
        </button>
      </div>

      <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#7c8699" }}>
            <th>Title</th>
            <th>Price</th>
            <th>Delivery</th>
            <th>Orders</th>
            <th>Keys left</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((p) => (
            <tr key={p.id} style={{ borderTop: "1px solid #1c2230" }}>
              <td>{p.title}</td>
              <td>{fmtMbite(p.priceMbite)} MBITE</td>
              <td style={subtle}>{p.deliveryMethod}</td>
              <td>{p._count.orders}</td>
              <td>{p._count.licenseKeys}</td>
            </tr>
          ))}
          {items === null && (
            <tr>
              <td colSpan={5} style={{ ...subtle, paddingTop: 12 }}>
                Loading products…
              </td>
            </tr>
          )}
          {items !== null && items.length === 0 && (
            <tr>
              <td colSpan={5} style={{ ...subtle, paddingTop: 12 }}>
                No products yet — add your first one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Orders({ setErr }: { setErr: (s: string | null) => void }) {
  const [items, setItems] = useState<DashOrder[] | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getMyOrders();
      setItems(data);
      setUpdatedAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load orders");
    }
  }, [setErr]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const shown = items ? items.slice(0, visible) : [];

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>
          Orders {items && items.length > 0 && <span style={subtle}>({items.length})</span>}
        </h2>
        <RefreshNote at={updatedAt} />
      </div>

      {items === null ? (
        <p style={{ ...subtle, marginBottom: 0 }}>Loading orders…</p>
      ) : items.length === 0 ? (
        <p style={{ ...subtle, marginBottom: 0 }}>
          No orders yet. Share your product links to start selling.
        </p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#7c8699" }}>
                  <th style={{ padding: "6px 8px 6px 0" }}>Product</th>
                  <th style={{ padding: "6px 8px" }}>Status</th>
                  <th style={{ padding: "6px 8px" }}>Amount</th>
                  <th style={{ padding: "6px 8px" }}>Received</th>
                  <th style={{ padding: "6px 8px" }}>Confs</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id} style={{ borderTop: "1px solid #1c2230" }}>
                    <td style={{ padding: "8px 8px 8px 0" }}>
                      <a
                        href={`/orders/${o.id}`}
                        style={{ color: "#e6e8ec", textDecoration: "none" }}
                        title="View buyer order page"
                      >
                        {o.product.title}
                      </a>
                    </td>
                    <td style={{ padding: "8px" }}>
                      <StatusPill status={o.status} />
                      {o.refund && (
                        <span style={{ ...subtle, fontSize: 12 }}> · refund {o.refund.status}</span>
                      )}
                    </td>
                    <td style={{ padding: "8px" }}>{fmtMbite(o.amountMbite)}</td>
                    <td style={{ padding: "8px" }}>{fmtMbite(o.receivedMbite)}</td>
                    <td style={{ padding: "8px" }}>
                      {o.confirmations}/{o.requiredConfirmations}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length > visible && (
            <button
              style={{ ...btn, background: "#2a3344", color: "#e6e8ec", marginTop: 14 }}
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
            >
              Show more ({items.length - visible})
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Refunds({ setErr }: { setErr: (s: string | null) => void }) {
  const [items, setItems] = useState<DashRefund[] | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [txids, setTxids] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const data = await getMyRefunds();
      setItems(data);
      setUpdatedAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load refunds");
    }
  }, [setErr]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  async function doSubmit(id: string) {
    setErr(null);
    try {
      await submitRefund(id, txids[id] ?? "");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }
  async function doReject(id: string) {
    setErr(null);
    try {
      await rejectRefund(id);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  const shown = items ? items.slice(0, visible) : [];

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>
          Refunds {items && items.length > 0 && <span style={subtle}>({items.length})</span>}
        </h2>
        <RefreshNote at={updatedAt} />
      </div>
      <p style={subtle}>
        Non-custodial: send MBITE back to the refund address from your wallet, then paste the txid to
        record it. We verify it on-chain and mark the order refunded.
      </p>

      {items === null ? (
        <p style={{ ...subtle, marginBottom: 0 }}>Loading refunds…</p>
      ) : items.length === 0 ? (
        <p style={{ ...subtle, marginBottom: 0 }}>No refund requests.</p>
      ) : (
        <>
          {shown.map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid #1c2230", paddingTop: 12, marginTop: 12 }}>
              <div>
                <strong>{r.order.product.title}</strong> · <StatusPill status={r.status} /> ·{" "}
                {fmtMbite(r.amountMbite)} MBITE
              </div>
              <div style={{ ...subtle, fontSize: 13, wordBreak: "break-all" }}>
                → {r.refundAddress}
                {r.txid && <> · tx {r.txid.slice(0, 16)}… ({r.confirmations} confs)</>}
              </div>
              {(r.status === "REQUESTED" || r.status === "SUBMITTED") && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <input
                    style={{ ...input, marginTop: 0, flex: "1 1 240px" }}
                    placeholder="refund txid"
                    value={txids[r.id] ?? ""}
                    onChange={(e) => setTxids({ ...txids, [r.id]: e.target.value })}
                  />
                  <button style={btn} onClick={() => doSubmit(r.id)}>
                    Record tx
                  </button>
                  <button
                    style={{ ...btn, background: "#2a3344", color: "#e6e8ec" }}
                    onClick={() => doReject(r.id)}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {items.length > visible && (
            <button
              style={{ ...btn, background: "#2a3344", color: "#e6e8ec", marginTop: 14 }}
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
            >
              Show more ({items.length - visible})
            </button>
          )}
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const green = ["FULFILLED", "PAID", "CONFIRMED"];
  const red = ["EXPIRED", "CANCELLED", "REJECTED", "UNDERPAID"];
  const color = green.includes(status) ? "#4ade80" : red.includes(status) ? "#ff6b6b" : "#e6c84a";
  return (
    <span style={{ color, fontWeight: 600, fontSize: 13 }}>{status}</span>
  );
}
