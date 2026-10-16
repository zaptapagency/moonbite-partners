"use client";

import { useCallback, useEffect, useState } from "react";
import { listBuyers, suspendBuyer, unsuspendBuyer, type AdminBuyer } from "../../../lib/admin";

export default function AdminBuyers() {
  const [rows, setRows] = useState<AdminBuyer[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listBuyers(q).then(setRows).catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
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
        <div><span className="eyebrow">Platform</span><h1 className="h2">Buyers</h1></div>
        <input className="input input-pill" style={{ maxWidth: 260 }} placeholder="Search email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <div className="banner banner-danger"><strong>{err}</strong></div>}
      <div className="card card-pad" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Email</th><th>Orders</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td style={{ fontWeight: 700 }}>{b.email}</td>
                <td>{b._count.orders}</td>
                <td className="muted" style={{ fontSize: 12 }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                <td>{b.suspended ? <span className="pill" style={{ background: "var(--yellow)" }}>Suspended</span> : <span className="pill pill-soft">Active</span>}</td>
                <td>
                  {b.suspended
                    ? <button className="btn btn-sm" disabled={busy === b.id} onClick={() => act(b.id, () => unsuspendBuyer(b.id))}>Reinstate</button>
                    : <button className="btn btn-sm btn-ink" disabled={busy === b.id} onClick={() => act(b.id, () => suspendBuyer(b.id))}>Suspend</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">No buyers found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
