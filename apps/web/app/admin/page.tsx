"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMetrics, fmtMbite, statusBadge, type Metrics } from "../../lib/admin";

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="k-trend k-flat">— no prior data</span>;
  const up = pct >= 0;
  return (
    <span className={`k-trend ${up ? "k-up" : "k-down"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% vs prior 7d
    </span>
  );
}

function Kpi({ label, value, sub, trend }: { label: string; value: string; sub?: React.ReactNode; trend?: number | null }) {
  return (
    <div className="card kpi">
      <div className="k-label">{label}</div>
      <div className="k-value">{value}</div>
      {trend !== undefined ? <Trend pct={trend} /> : sub ? <div className="k-sub">{sub}</div> : null}
    </div>
  );
}

/** Clean inline SVG area chart for the 14-day orders series. */
function AreaChart({ data }: { data: { date: string; orders: number }[] }) {
  const W = 760, H = 180, P = 8;
  const max = Math.max(1, ...data.map((d) => d.orders));
  const step = data.length > 1 ? (W - P * 2) / (data.length - 1) : 0;
  const x = (i: number) => P + i * step;
  const y = (v: number) => H - P - (v / max) * (H - P * 2 - 14);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.orders).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 180, display: "block" }}>
      <defs>
        <linearGradient id="afill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--a-accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--a-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={P} x2={W - P} y1={(H - P * 2 - 14) * g + P} y2={(H - P * 2 - 14) * g + P} stroke="var(--a-line)" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#afill)" />
      <path d={line} fill="none" stroke="var(--a-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => d.orders > 0 && i === data.length - 1 ? (
        <circle key={i} cx={x(i)} cy={y(d.orders)} r="3.5" fill="var(--a-accent)" stroke="#fff" strokeWidth="1.5" />
      ) : null)}
    </svg>
  );
}

export default function AdminOverview() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getMetrics().then(setM).catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (err) return <div className="banner banner-danger"><strong>{err}</strong></div>;
  if (!m) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card kpi"><div className="skeleton" style={{ height: 48 }} /></div>)}
      </div>
    );
  }

  const totalOrders14 = m.timeseries.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="stack-lg">
      <div className="adm-head">
        <div><h1 className="h2">Overview</h1><p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>Platform health at a glance.</p></div>
        <span className="pill pill-soft">Last 14 days</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <Kpi label="GMV · all time" value={`${fmtMbite(m.gmv.allTime.mbite)} MBITE`} sub={`${m.gmv.allTime.orders} settled orders`} />
        <Kpi label="Platform fees" value={`${fmtMbite(m.gmv.allTime.fees)} MBITE`} sub={`${fmtMbite(m.gmv.last7d.fees)} in last 7d`} />
        <Kpi label="Orders · 14d" value={String(totalOrders14)} trend={m.trends.orders7d} />
        <Kpi label="Merchants" value={String(m.counts.merchants)} sub={`${m.counts.suspendedMerchants} suspended`} />
        <Kpi label="Products" value={String(m.counts.products)} sub={`${m.counts.activeProducts} active`} />
        <Kpi label="Buyers" value={String(m.counts.buyers)} sub="registered accounts" />
      </div>

      <section className="card card-pad">
        <div className="spread" style={{ marginBottom: 6 }}>
          <div><div className="k-label">Orders</div><div style={{ fontSize: 20, fontWeight: 700 }}>{totalOrders14}<span className="muted" style={{ fontSize: 13, fontWeight: 500 }}> in 14 days</span></div></div>
          <Trend pct={m.trends.orders7d} />
        </div>
        <AreaChart data={m.timeseries} />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}>
        <section className="card card-pad">
          <h2 className="h3" style={{ marginBottom: 12 }}>Orders by status</h2>
          <div className="stack" style={{ gap: 10 }}>
            {Object.entries(m.ordersByStatus).sort((a, b) => b[1] - a[1]).map(([s, n]) => {
              const max = Math.max(...Object.values(m.ordersByStatus));
              return (
                <div key={s}>
                  <div className="spread" style={{ marginBottom: 4 }}>
                    <span className={`badge ${statusBadge(s)}`}>{s.replace(/_/g, " ").toLowerCase()}</span>
                    <strong style={{ fontSize: 13 }}>{n}</strong>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--a-line)", overflow: "hidden" }}>
                    <div style={{ width: `${(n / max) * 100}%`, height: "100%", background: "var(--a-accent)", opacity: .75 }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(m.ordersByStatus).length === 0 && <p className="muted">No orders yet.</p>}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="h3" style={{ marginBottom: 12 }}>Top merchants</h2>
          <table className="tbl">
            <thead><tr><th>Merchant</th><th>GMV</th><th>Orders</th></tr></thead>
            <tbody>
              {m.topMerchants.map((t) => (
                <tr key={t.id}>
                  <td><Link href="/admin/merchants" className="link" style={{ fontWeight: 600 }}>{t.displayName}</Link>{t.suspended && <span className="badge badge-amber" style={{ marginLeft: 6 }}>suspended</span>}</td>
                  <td>{fmtMbite(t.gmvMbite)}</td>
                  <td>{t.orders}</td>
                </tr>
              ))}
              {m.topMerchants.length === 0 && <tr><td colSpan={3} className="muted">No sales yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card">
        <div className="card-pad" style={{ paddingBottom: 0 }}><h2 className="h3">Recent orders</h2></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Product</th><th>Merchant</th><th>Amount</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {m.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600 }}>{o.product.title}</td>
                  <td className="muted">{o.merchant.displayName}</td>
                  <td>{fmtMbite(o.amountMbite)} MBITE</td>
                  <td><span className={`badge ${statusBadge(o.status)}`}>{o.status.replace(/_/g, " ").toLowerCase()}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {m.recentOrders.length === 0 && <tr><td colSpan={5} className="muted">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
