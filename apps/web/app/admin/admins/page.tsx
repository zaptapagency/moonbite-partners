"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  type AdminStaff,
  type AdminRole,
} from "../../../lib/admin";

export default function AdminStaffPage() {
  const [rows, setRows] = useState<AdminStaff[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", displayName: "", password: "", role: "ADMIN" as AdminRole });

  const load = useCallback(() => {
    listAdmins().then(setRows).catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setErr(null);
    try { await fn(); load(); } catch (e) { setErr(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(null); }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await run("new", async () => {
      await createAdmin({ ...form, email: form.email.trim() });
      setForm({ email: "", displayName: "", password: "", role: "ADMIN" });
    });
  }

  return (
    <div className="stack-lg">
      <div><span className="eyebrow">Super admin</span><h1 className="h2">Admins</h1></div>
      {err && <div className="banner banner-danger"><strong>{err}</strong></div>}

      <section className="card card-pad" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Admin</th><th>Role</th><th>Status</th><th>Last login</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><div style={{ fontWeight: 700 }}>{a.displayName}</div><div className="muted" style={{ fontSize: 12 }}>{a.email}</div></td>
                <td>
                  <select className="select" style={{ width: "auto", padding: "4px 8px" }} value={a.role} disabled={busy === a.id}
                    onChange={(e) => run(a.id, () => updateAdmin(a.id, { role: e.target.value as AdminRole }))}>
                    <option value="ADMIN">ADMIN</option><option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </td>
                <td>{a.active ? <span className="pill pill-soft">Active</span> : <span className="pill" style={{ background: "var(--yellow)" }}>Disabled</span>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : "never"}</td>
                <td className="row" style={{ gap: 6 }}>
                  <button className="btn btn-sm" disabled={busy === a.id} onClick={() => run(a.id, () => updateAdmin(a.id, { active: !a.active }))}>{a.active ? "Disable" : "Enable"}</button>
                  <button className="btn btn-sm btn-ink" disabled={busy === a.id} onClick={() => { if (window.confirm(`Delete ${a.email}?`)) run(a.id, () => deleteAdmin(a.id)); }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <form onSubmit={add} className="panel stack" style={{ maxWidth: 520 }}>
        <h2 className="h3">Add an admin</h2>
        <div className="row" style={{ gap: 10 }}>
          <input className="input" style={{ flex: "1 1 180px" }} placeholder="Name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
          <input className="input" style={{ flex: "1 1 180px" }} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <input className="input" style={{ flex: "1 1 180px" }} type="password" placeholder="Temp password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select className="select" style={{ flex: "0 1 180px" }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}>
            <option value="ADMIN">ADMIN</option><option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
        </div>
        <button className="btn btn-accent" disabled={busy === "new"}>{busy === "new" ? "Creating…" : "Create admin"}</button>
      </form>
    </div>
  );
}
