"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken } from "../../../lib/dashboard";
import { getMyProfile, updateMyProfile } from "../../../lib/storefront";

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

  if (booting) return <p className="muted">Loading…</p>;

  if (!authed)
    return (
      <div className="stack" style={{ maxWidth: 420 }}>
        <h1 className="h1">Storefront profile</h1>
        <p className="muted">
          You need to be signed in.{" "}
          <Link href="/dashboard" style={{ fontWeight: 700 }}>
            Go to the dashboard →
          </Link>
        </p>
      </div>
    );

  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <div className="spread">
        <h1 className="h1">Storefront profile</h1>
        <Link href="/dashboard" className="btn btn-sm">
          ← Back to dashboard
        </Link>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Your public, Gumroad-style storefront lives at a handle you choose.
      </p>

      {savedHandle && (
        <div className="panel">
          <div className="label" style={{ marginBottom: 4 }}>Your public storefront</div>
          <Link
            href={`/${savedHandle}`}
            style={{ textDecoration: "none", fontWeight: 800, fontSize: 20 }}
          >
            /{savedHandle}
          </Link>
        </div>
      )}

      <div className="card card-pad stack">
        <div>
          <label className="label">Handle</label>
          <input
            className="input"
            placeholder="your-handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
          <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
            3–30 characters: lowercase letters, numbers and hyphens. This is your public URL.
          </p>
        </div>

        <div>
          <label className="label">Bio</label>
          <textarea
            className="textarea"
            style={{ minHeight: 90, resize: "vertical" }}
            placeholder="Tell buyers who you are…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Avatar URL</label>
          <input
            className="input"
            placeholder="https://…"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </div>

        {err && <p style={{ color: "#c0392b", fontWeight: 700, margin: 0 }}>{err}</p>}
        {ok && (
          <span className="pill pill-mint" style={{ alignSelf: "flex-start" }}>
            Saved
          </span>
        )}

        <div>
          <button className="btn btn-accent" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
