"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listMerchants,
  suspendMerchant,
  unsuspendMerchant,
  setMerchantFee,
  setMerchantTier,
  type AdminMerchant,
} from "../../../lib/admin";

const TIERS = ["STARTER", "VERIFIED", "ELITE"];

export default function AdminMerchants() {
  const [rows, setRows] = useState<AdminMerchant[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listMerchants(q).then(setRows).catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setErr(null);
    try { await fn(); load(); } catch (e) { setErr(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(null); }
  }

  return (
    <div className="stack-lg">
      <div className="section-head">
        <div><span className="eyebrow">Platform</span><h1 className="h2">Merchants</h1></div>
        <input className="input input-pill" style={{ maxWidth: 260 }} placeholder="Search name / email / handle" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <div className="banner banner-danger"><strong>{err}</strong></div>}
      <div className="card card-pad" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Merchant</th><th>Tier</th><th>Fee</th><th>Products</th><th>Orders</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{m.displayName}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{m.email}{m.handle ? ` · @${m.handle}` : ""}</div>
                </td>
                <td>
                  <select className="select" style={{ padding: "4px 8px", width: "auto" }} value={m.tier}
                    onChange={(e) => act(m.id, () => setMerchantTier(m.id, e.target.value))} disabled={busy === m.id}>
                    {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td>
                  <button className="btn btn-sm btn-ghost" disabled={busy === m.id}
                    onClick={() => { const v = window.prompt(`Fee in basis points for ${m.displayName} (100 = 1%)`, String(m.feeBps)); if (v !== null) act(m.id, () => setMerchantFee(m.id, Number(v))); }}>
                    {(m.feeBps / 100).toFixed(2)}%
                  </button>
                </td>
                <td>{m._count.products}</td>
                <td>{m._count.orders}</td>
                <td>{m.suspended ? <span className="pill" style={{ background: "var(--yellow)" }}>Suspended</span> : <span className="pill pill-soft">Active</span>}</td>
                <td>
                  {m.suspended
                    ? <button className="btn btn-sm" disabled={busy === m.id} onClick={() => act(m.id, () => unsuspendMerchant(m.id))}>Reinstate</button>
                    : <button className="btn btn-sm btn-ink" disabled={busy === m.id} onClick={() => { const r = window.prompt("Reason for suspension (optional)") ?? undefined; act(m.id, () => suspendMerchant(m.id, r)); }}>Suspend</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">No merchants found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
