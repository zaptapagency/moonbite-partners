"use client";

import { useCallback, useEffect, useState } from "react";
import { listReviews, deleteReview, type AdminReview } from "../../../lib/admin";

export default function AdminReviews() {
  const [rows, setRows] = useState<AdminReview[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listReviews(q).then(setRows).catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function remove(id: string) {
    if (!window.confirm("Delete this review permanently?")) return;
    setBusy(id); setErr(null);
    try { await deleteReview(id); load(); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  return (
    <div className="stack-lg">
      <div className="section-head">
        <div><span className="eyebrow">Moderation</span><h1 className="h2">Reviews</h1></div>
        <input className="input input-pill" style={{ maxWidth: 260 }} placeholder="Search comment text" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <div className="banner banner-danger"><strong>{err}</strong></div>}
      <div className="card card-pad" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Rating</th><th>Comment</th><th>Product</th><th>By</th><th>When</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><span className="stars">{"★".repeat(r.rating)}<span className="off">{"★".repeat(5 - r.rating)}</span></span></td>
                <td style={{ maxWidth: 360 }}>{r.comment ?? <span className="muted">—</span>}</td>
                <td className="muted">{r.product.title}</td>
                <td className="muted">{r.buyerRef ?? "—"}</td>
                <td className="muted" style={{ fontSize: 12 }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td><button className="btn btn-sm btn-ink" disabled={busy === r.id} onClick={() => remove(r.id)}>Delete</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">No reviews found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
