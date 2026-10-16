"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminLogin } from "../../../lib/admin";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminLogin(email.trim(), password);
      router.replace("/admin");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="center" style={{ minHeight: "60vh" }}>
      <form onSubmit={submit} className="panel panel-white stack" style={{ maxWidth: 400, width: "100%", boxShadow: "var(--shadow)" }}>
        <div>
          <span className="eyebrow">MoonBite Partners</span>
          <h1 className="h2" style={{ fontSize: 28 }}>Admin console</h1>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>
            Staff sign-in. Merchants and buyers log in from their own pages.
          </p>
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@moonbite.example" autoComplete="username" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {err && <div className="banner banner-danger" style={{ padding: 14 }}><strong>{err}</strong></div>}
        <button className="btn btn-accent btn-block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
