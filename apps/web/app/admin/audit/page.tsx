"use client";

import { useCallback, useEffect, useState } from "react";
import { listAudit, type AuditEntry } from "../../../lib/admin";

export default function AdminAudit() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [action, setAction] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    listAudit(action).then(setRows).catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, [action]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  return (
    <div className="stack-lg">
      <div className="section-head">
        <div><span className="eyebrow">Super admin</span><h1 className="h2">Audit log</h1></div>
        <input className="input input-pill" style={{ maxWidth: 240 }} placeholder="Filter action e.g. merchant.suspend" value={action} onChange={(e) => setAction(e.target.value)} />
      </div>
      {err && <div className="banner banner-danger"><strong>{err}</strong></div>}
      <div className="card card-pad" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{new Date(a.createdAt).toLocaleString()}</td>
                <td>{a.admin?.email ?? <span className="muted">—</span>}</td>
                <td><span className="pill pill-soft">{a.action}</span></td>
                <td className="muted" style={{ fontSize: 12 }}>{a.targetType ? `${a.targetType} ${a.targetId?.slice(0, 8) ?? ""}` : "—"}</td>
                <td className="mono" style={{ fontSize: 11, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.metadata ? JSON.stringify(a.metadata) : ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">No audit entries.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
