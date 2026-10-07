"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { resetPassword } from "../../../lib/dashboard";

export default function ResetPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "working" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function submit() {
    if (password.length < 8) {
      setState("error");
      setMsg("Password must be at least 8 characters.");
      return;
    }
    setState("working");
    try {
      await resetPassword(token, password);
      setState("ok");
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Reset failed.");
    }
  }

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

  return (
    <div style={{ maxWidth: 440 }}>
      <h1>Reset your password</h1>
      {!token && <p style={{ color: "#ff6b6b" }}>This link is missing its token.</p>}
      {state === "ok" ? (
        <p style={{ color: "#4ade80" }}>
          ✅ Password updated.{" "}
          <Link href="/dashboard" style={{ color: "#8ab4ff" }}>
            Sign in
          </Link>
          .
        </p>
      ) : (
        <>
          <label>
            New password
            <input
              style={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!token}
            />
          </label>
          {state === "error" && <p style={{ color: "#ff6b6b" }}>{msg}</p>}
          <button
            onClick={submit}
            disabled={!token || state === "working"}
            style={{
              marginTop: 14,
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: "#8ab4ff",
              color: "#0b0e14",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {state === "working" ? "Saving…" : "Set new password"}
          </button>
        </>
      )}
    </div>
  );
}
