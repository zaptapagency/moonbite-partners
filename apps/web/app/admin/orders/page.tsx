"use client";

import { useCallback, useEffect, useState } from "react";
import { listOrders, fmtMbite, type AdminOrder } from "../../../lib/admin";

const STATUSES = ["AWAITING_PAYMENT", "DETECTED", "UNDERPAID", "OVERPAID", "PAID", "FULFILLED", "EXPIRED", "REFUNDED", "CANCELLED"];

export default function AdminOrders() {
  const [rows, setRows] = useState<AdminOrder[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    listOrders(status, q).then(setRows).catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, [status, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  return (
    <div className="stack-lg">
      <div className="section-head">
        <div><span className="eyebrow">Oversight</span><h1 className="h2">Orders</h1></div>
        <div className="row" style={{ gap: 10 }}>
          <input className="input input-pill" style={{ maxWidth: 220 }} placeholder="Search id / address / buyer" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ width: "auto", borderRadius: 999 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {err && <div className="banner banner-danger"><strong>{err}</strong></div>}
      <div className="card card-pad" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Order</th><th>Product</th><th>Merchant</th><th>Amount</th><th>Confs</th><th>Status</th><th>When</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="mono" style={{ fontSize: 11 }}>{o.id.slice(0, 10)}…{o.refund ? <span className="pill pill-soft" style={{ marginLeft: 6, fontSize: 10 }}>refund {o.refund.status}</span> : null}</td>
                <td>{o.product.title}</td>
                <td className="muted">{o.merchant.displayName}</td>
                <td>{fmtMbite(o.amountMbite)}{o.receivedMbite !== "0" && o.receivedMbite !== o.amountMbite ? ` (got ${fmtMbite(o.receivedMbite)})` : ""}</td>
                <td>{o.confirmations}/{o.requiredConfirmations}</td>
                <td><span className="pill pill-soft">{o.status}</span></td>
                <td className="muted" style={{ fontSize: 12 }}>{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">No orders found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
