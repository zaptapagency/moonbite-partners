"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMetrics, fmtMbite, type Metrics } from "../../lib/admin";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <div className="eyebrow">{label}</div>
      <div className="price" style={{ fontSize: 26, marginTop: 4 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function AdminOverview() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getMetrics().then(setM).catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (err) return <div className="banner banner-danger"><strong>{err}</strong></div>;
  if (!m) return <p className="muted">Loading metrics…</p>;

  return (
    <div className="stack-lg">
      <div>
        <span className="eyebrow">Platform</span>
        <h1 className="h2">Overview</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16 }}>
        <Stat label="GMV (all time)" value={`${fmtMbite(m.gmv.allTime.mbite)} MBITE`} sub={`${m.gmv.allTime.orders} settled orders`} />
        <Stat label="Platform fees" value={`${fmtMbite(m.gmv.allTime.fees)} MBITE`} sub={`${fmtMbite(m.gmv.last7d.fees)} in last 7d`} />
        <Stat label="Merchants" value={String(m.counts.merchants)} sub={`${m.counts.suspendedMerchants} suspended`} />
        <Stat label="Buyers" value={String(m.counts.buyers)} />
        <Stat label="Products" value={String(m.counts.products)} sub={`${m.counts.activeProducts} active`} />
        <Stat label="Orders" value={String(m.counts.orders)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 20 }}>
        <section className="card card-pad">
          <h2 className="h3" style={{ marginBottom: 10 }}>Orders by status</h2>
          <div className="stack" style={{ gap: 8 }}>
            {Object.entries(m.ordersByStatus).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
              <div key={s} className="spread">
                <span className="pill pill-soft">{s}</span>
                <strong>{n}</strong>
              </div>
            ))}
            {Object.keys(m.ordersByStatus).length === 0 && <p className="muted">No orders yet.</p>}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="h3" style={{ marginBottom: 10 }}>Top merchants (GMV)</h2>
          <table className="tbl">
            <thead><tr><th>Merchant</th><th>GMV</th><th>Orders</th></tr></thead>
            <tbody>
              {m.topMerchants.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/admin/merchants?q=${encodeURIComponent(t.displayName)}`} className="link">{t.displayName}</Link>
                    {t.suspended && <span className="pill pill-soft" style={{ marginLeft: 6, fontSize: 10 }}>suspended</span>}
                  </td>
                  <td>{fmtMbite(t.gmvMbite)}</td>
                  <td>{t.orders}</td>
                </tr>
              ))}
              {m.topMerchants.length === 0 && <tr><td colSpan={3} className="muted">No sales yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card card-pad">
        <h2 className="h3" style={{ marginBottom: 10 }}>Recent orders</h2>
        <table className="tbl">
          <thead><tr><th>Product</th><th>Merchant</th><th>Amount</th><th>Status</th><th>When</th></tr></thead>
          <tbody>
            {m.recentOrders.map((o) => (
              <tr key={o.id}>
                <td>{o.product.title}</td>
                <td className="muted">{o.merchant.displayName}</td>
                <td>{fmtMbite(o.amountMbite)} MBITE</td>
                <td><span className="pill pill-soft">{o.status}</span></td>
                <td className="muted" style={{ fontSize: 12 }}>{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {m.recentOrders.length === 0 && <tr><td colSpan={5} className="muted">No orders yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
