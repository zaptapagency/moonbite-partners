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
    <span className="muted" style={{ fontSize: 12 }}>
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

  if (booting) return <p className="muted">Loading…</p>;
  if (!profile) return <AuthForm onAuthed={load} />;

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="h1">Merchant dashboard</h1>
        <button
          className="btn btn-sm"
          onClick={() => {
            clearToken();
            setProfile(null);
          }}
        >
          Sign out
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {profile.displayName} · {profile.email} · tier <strong>{profile.tier}</strong> · fee{" "}
        {(profile.feeBps / 100).toFixed(2)}%
      </p>
      <nav className="row">
        <a href="/dashboard/profile" className="pill pill-sky" style={{ textDecoration: "none" }}>
          Storefront profile →
        </a>
        <a href="/dashboard/discounts" className="pill pill-yellow" style={{ textDecoration: "none" }}>
          Discount codes →
        </a>
      </nav>
      {err && (
        <div className="banner banner-danger">
          <strong>{err}</strong>
        </div>
      )}

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
    <div className="stack" style={{ maxWidth: 420 }}>
      <h1 className="h1">{mode === "login" ? "Merchant sign in" : "Create merchant account"}</h1>
      <div className="card card-pad stack">
        {mode === "register" && (
          <div>
            <label className="label">Display name</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err && <p style={{ color: "#c0392b", fontWeight: 700, margin: 0 }}>{err}</p>}
        <button className="btn btn-accent btn-block" onClick={submit} disabled={busy}>
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </div>
      <button
        className="btn btn-sm"
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
    <div className="card card-pad stack">
      <div className="spread">
        <h2 className="h2">Settlement</h2>
        {profile.xpubConfigured ? (
          <span className="pill pill-mint">xpub configured</span>
        ) : (
          <span className="pill pill-yellow">no xpub set</span>
        )}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Payouts are non-custodial — orders pay fresh addresses derived from your xpub.{" "}
        {profile.xpubConfigured
          ? "You're ready to receive payments."
          : "Set an xpub below to start receiving payments."}
      </p>
      <div>
        <label className="label">Settlement xpub</label>
        <input className="input" placeholder="xpub…" value={xpub} onChange={(e) => setXpubVal(e.target.value)} />
      </div>
      <div>
        <button className="btn btn-accent" onClick={save} disabled={busy || !xpub}>
          {busy ? "Saving…" : profile.xpubConfigured ? "Replace xpub" : "Save xpub"}
        </button>
      </div>
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
    <div className="card card-pad stack">
      <h2 className="h2">Products</h2>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 160px" }}>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 100px" }}>
          <label className="label">Price (MBITE)</label>
          <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label className="label">Delivery</label>
          <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="LICENSE_KEY">License key</option>
            <option value="SIGNED_DOWNLOAD">Signed download</option>
            <option value="WEBHOOK">Webhook</option>
            <option value="COURSE_ACCESS">Course access</option>
          </select>
        </div>
        <button className="btn btn-accent" onClick={add} disabled={busy || !title || !price}>
          Add
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Title</th>
              <th>Price</th>
              <th>Delivery</th>
              <th>Orders</th>
              <th>Keys left</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 700 }}>{p.title}</td>
                <td>{fmtMbite(p.priceMbite)} MBITE</td>
                <td className="muted">{p.deliveryMethod}</td>
                <td>{p._count.orders}</td>
                <td>{p._count.licenseKeys}</td>
              </tr>
            ))}
            {items === null && (
              <tr>
                <td colSpan={5} className="muted">
                  Loading products…
                </td>
              </tr>
            )}
            {items !== null && items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No products yet — add your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
    <div className="card card-pad stack">
      <div className="spread" style={{ alignItems: "baseline" }}>
        <h2 className="h2">
          Orders {items && items.length > 0 && <span className="muted">({items.length})</span>}
        </h2>
        <RefreshNote at={updatedAt} />
      </div>

      {items === null ? (
        <p className="muted" style={{ margin: 0 }}>Loading orders…</p>
      ) : items.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No orders yet. Share your product links to start selling.
        </p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Received</th>
                  <th>Confs</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <a
                        href={`/orders/${o.id}`}
                        style={{ textDecoration: "none", fontWeight: 700 }}
                        title="View buyer order page"
                      >
                        {o.product.title}
                      </a>
                    </td>
                    <td>
                      <StatusPill status={o.status} />
                      {o.refund && (
                        <span className="muted" style={{ fontSize: 12 }}> · refund {o.refund.status}</span>
                      )}
                    </td>
                    <td>{fmtMbite(o.amountMbite)}</td>
                    <td>{fmtMbite(o.receivedMbite)}</td>
                    <td>
                      {o.confirmations}/{o.requiredConfirmations}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length > visible && (
            <div>
              <button className="btn btn-sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show more ({items.length - visible})
              </button>
            </div>
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
    <div className="card card-pad stack">
      <div className="spread" style={{ alignItems: "baseline" }}>
        <h2 className="h2">
          Refunds {items && items.length > 0 && <span className="muted">({items.length})</span>}
        </h2>
        <RefreshNote at={updatedAt} />
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Non-custodial: send MBITE back to the refund address from your wallet, then paste the txid to
        record it. We verify it on-chain and mark the order refunded.
      </p>

      {items === null ? (
        <p className="muted" style={{ margin: 0 }}>Loading refunds…</p>
      ) : items.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No refund requests.</p>
      ) : (
        <>
          {shown.map((r) => (
            <div key={r.id} className="panel stack" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <strong>{r.order.product.title}</strong>
                <StatusPill status={r.status} />
                <span className="muted">{fmtMbite(r.amountMbite)} MBITE</span>
              </div>
              <div className="muted mono" style={{ fontSize: 13, wordBreak: "break-all" }}>
                → {r.refundAddress}
                {r.txid && <> · tx {r.txid.slice(0, 16)}… ({r.confirmations} confs)</>}
              </div>
              {(r.status === "REQUESTED" || r.status === "SUBMITTED") && (
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="input"
                    style={{ flex: "1 1 240px", width: "auto" }}
                    placeholder="refund txid"
                    value={txids[r.id] ?? ""}
                    onChange={(e) => setTxids({ ...txids, [r.id]: e.target.value })}
                  />
                  <button className="btn btn-accent btn-sm" onClick={() => doSubmit(r.id)}>
                    Record tx
                  </button>
                  <button className="btn btn-sm" onClick={() => doReject(r.id)}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {items.length > visible && (
            <div>
              <button className="btn btn-sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show more ({items.length - visible})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const green = ["FULFILLED", "PAID", "CONFIRMED"];
  const red = ["EXPIRED", "CANCELLED", "REJECTED", "UNDERPAID"];
  const cls = green.includes(status) ? "pill pill-mint" : "pill";
  const style = red.includes(status)
    ? { background: "#ffd9d6" }
    : green.includes(status)
      ? undefined
      : { background: "var(--yellow)" };
  return (
    <span className={cls} style={style}>
      {status}
    </span>
  );
}
