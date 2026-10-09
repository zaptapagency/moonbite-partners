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

  return (
    <div className="card card-pad stack" style={{ maxWidth: 440, margin: "0 auto" }}>
      <h1 className="h2">Reset your password</h1>
      {!token && <div className="banner banner-danger">This link is missing its token.</div>}
      {state === "ok" ? (
        <div className="banner banner-success">
          Password updated.{" "}
          <Link href="/dashboard" style={{ fontWeight: 700 }}>
            Sign in
          </Link>
          .
        </div>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="reset-password">
              New password
            </label>
            <input
              id="reset-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!token}
            />
          </div>
          {state === "error" && <div className="banner banner-danger">{msg}</div>}
          <button
            onClick={submit}
            disabled={!token || state === "working"}
            className="btn btn-accent btn-block"
          >
            {state === "working" ? "Saving…" : "Set new password"}
          </button>
        </>
      )}
    </div>
  );
}
