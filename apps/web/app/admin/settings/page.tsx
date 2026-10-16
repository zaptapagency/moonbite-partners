"use client";

import { useCallback, useEffect, useState } from "react";
import { getSettings, setSetting } from "../../../lib/admin";

// Known platform toggles surfaced as friendly controls; the raw editor below
// can set any key.
const KNOWN: { key: string; label: string; type: "bool" | "number"; hint: string }[] = [
  { key: "signupsPaused", label: "Pause merchant signups", type: "bool", hint: "Blocks new merchant registration." },
  { key: "maintenanceMode", label: "Maintenance mode", type: "bool", hint: "Show a maintenance banner to buyers." },
  { key: "defaultFeeBps", label: "Default platform fee (bps)", type: "number", hint: "Applied to new merchants (100 = 1%)." },
];

export default function AdminSettings() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [rawKey, setRawKey] = useState("");
  const [rawVal, setRawVal] = useState("");

  const load = useCallback(() => {
    getSettings().then(setValues).catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(key: string, value: unknown) {
    setErr(null); setOk(null);
    try { await setSetting(key, value); setOk(`Saved ${key}`); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }

  async function saveRaw(e: React.FormEvent) {
    e.preventDefault();
    let parsed: unknown = rawVal;
    try { parsed = JSON.parse(rawVal); } catch { /* keep as string */ }
    await save(rawKey.trim(), parsed);
    setRawKey(""); setRawVal("");
  }

  return (
    <div className="stack-lg">
      <div><span className="eyebrow">Super admin</span><h1 className="h2">Platform settings</h1></div>
      {err && <div className="banner banner-danger"><strong>{err}</strong></div>}
      {ok && <div className="banner banner-success" style={{ padding: 12 }}><strong>{ok}</strong></div>}

      <section className="card card-pad stack">
        {KNOWN.map((s) => (
          <div key={s.key} className="spread" style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{s.label}</div>
              <div className="muted" style={{ fontSize: 12 }}>{s.hint} <code>{s.key}</code></div>
            </div>
            {s.type === "bool" ? (
              <button className={values[s.key] ? "btn btn-sm btn-ink" : "btn btn-sm"} onClick={() => save(s.key, !values[s.key])}>
                {values[s.key] ? "On" : "Off"}
              </button>
            ) : (
              <input className="input" style={{ maxWidth: 120 }} defaultValue={String(values[s.key] ?? "")} inputMode="numeric"
                onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) save(s.key, n); }} />
            )}
          </div>
        ))}
      </section>

      <form onSubmit={saveRaw} className="panel stack" style={{ maxWidth: 520 }}>
        <h2 className="h3">Set any key</h2>
        <input className="input" placeholder="key" value={rawKey} onChange={(e) => setRawKey(e.target.value)} required />
        <input className="input" placeholder='value (JSON or text, e.g. true, 42, "hi")' value={rawVal} onChange={(e) => setRawVal(e.target.value)} />
        <button className="btn btn-accent" disabled={!rawKey.trim()}>Save setting</button>
      </form>
    </div>
  );
}
