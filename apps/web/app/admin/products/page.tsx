"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listProducts,
  takedownProduct,
  restoreProduct,
  fmtMbite,
  type AdminProduct,
} from "../../../lib/admin";

export default function AdminProducts() {
  const [rows, setRows] = useState<AdminProduct[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listProducts(q, status).then(setRows).catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, [q, status]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setErr(null);
    try { await fn(); load(); } catch (e) { setErr(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(null); }
  }

  return (
    <div className="stack-lg">
      <div className="section-head">
        <div><span className="eyebrow">Moderation</span><h1 className="h2">Products</h1></div>
        <div className="row" style={{ gap: 10 }}>
          <input className="input input-pill" style={{ maxWidth: 220 }} placeholder="Search title / category" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ width: "auto", borderRadius: 999 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option><option value="active">Active</option><option value="down">Taken down</option>
          </select>
        </div>
      </div>
      {err && <div className="banner banner-danger"><strong>{err}</strong></div>}
      <div className="card card-pad" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Product</th><th>Merchant</th><th>Price</th><th>Orders</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{p.category ?? "—"}{p.takedownReason ? ` · ${p.takedownReason}` : ""}</div>
                </td>
                <td className="muted">{p.merchant.displayName}{p.merchant.suspended ? " (suspended)" : ""}</td>
                <td>{fmtMbite(p.priceMbite)} MBITE</td>
                <td>{p._count.orders}</td>
                <td>{p.active ? <span className="pill pill-soft">Live</span> : <span className="pill" style={{ background: "var(--yellow)" }}>Down</span>}</td>
                <td>
                  {p.active
                    ? <button className="btn btn-sm btn-ink" disabled={busy === p.id} onClick={() => { const r = window.prompt("Takedown reason", "Policy violation") ?? undefined; act(p.id, () => takedownProduct(p.id, r)); }}>Take down</button>
                    : <button className="btn btn-sm" disabled={busy === p.id} onClick={() => act(p.id, () => restoreProduct(p.id))}>Restore</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">No products found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
