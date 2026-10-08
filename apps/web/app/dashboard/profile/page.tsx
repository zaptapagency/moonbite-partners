"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken } from "../../../lib/dashboard";
import { getMyProfile, updateMyProfile } from "../../../lib/storefront";

const card: React.CSSProperties = {
  border: "1px solid #1c2230",
  borderRadius: 12,
  padding: 16,
  background: "#111622",
  marginBottom: 16,
};
const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #2a3344",
  background: "#0b0e14",
  color: "#e6e8ec",
  marginTop: 6,
  boxSizing: "border-box",
};
const btn: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "#8ab4ff",
  color: "#0b0e14",
  fontWeight: 700,
  cursor: "pointer",
};
const subtle = { color: "#9aa4b2" as const };

export default function ProfileEditorPage() {
  const [booting, setBooting] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savedHandle, setSavedHandle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }
    getMyProfile()
      .then((p) => {
        setAuthed(true);
        setHandle(p.handle ?? "");
        setBio(p.bio ?? "");
        setAvatarUrl(p.avatarUrl ?? "");
        setSavedHandle(p.handle);
      })
      .catch(() => setAuthed(false))
      .finally(() => setBooting(false));
  }, []);

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const p = await updateMyProfile({
        handle: handle.trim() || undefined,
        bio,
        avatarUrl,
      });
      setSavedHandle(p.handle);
      setHandle(p.handle ?? "");
      setBio(p.bio ?? "");
      setAvatarUrl(p.avatarUrl ?? "");
      setOk(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  if (booting) return <p>Loading…</p>;

  if (!authed)
    return (
      <div style={{ maxWidth: 420 }}>
        <h1>Storefront profile</h1>
        <p style={subtle}>
          You need to be signed in.{" "}
          <Link href="/dashboard" style={{ color: "#8ab4ff", textDecoration: "none" }}>
            Go to the dashboard →
          </Link>
        </p>
      </div>
    );

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ marginBottom: 0 }}>Storefront profile</h1>
        <Link href="/dashboard" style={{ color: "#8ab4ff", textDecoration: "none", fontWeight: 500 }}>
          ← Back to dashboard
        </Link>
      </div>
      <p style={subtle}>
        Your public, Gumroad-style storefront lives at a handle you choose.
      </p>

      {savedHandle && (
        <div style={{ ...card, borderColor: "#223052" }}>
          <div style={subtle}>Your public storefront</div>
          <Link
            href={`/${savedHandle}`}
            style={{ color: "#8ab4ff", textDecoration: "none", fontWeight: 600, fontSize: 18 }}
          >
            /{savedHandle}
          </Link>
        </div>
      )}

      <div style={card}>
        <label>
          Handle
          <input
            style={input}
            placeholder="your-handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </label>
        <p style={{ ...subtle, fontSize: 12, marginTop: 6 }}>
          3–30 characters: lowercase letters, numbers and hyphens. This is your public URL.
        </p>

        <label>
          Bio
          <textarea
            style={{ ...input, minHeight: 90, resize: "vertical" }}
            placeholder="Tell buyers who you are…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>

        <label>
          Avatar URL
          <input
            style={input}
            placeholder="https://…"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </label>

        {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}
        {ok && <p style={{ color: "#4ade80" }}>Saved.</p>}

        <button style={{ ...btn, marginTop: 14 }} onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
