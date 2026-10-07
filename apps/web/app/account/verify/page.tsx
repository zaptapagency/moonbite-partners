"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { verifyEmail } from "../../../lib/dashboard";

export default function VerifyPage() {
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    if (!token) {
      setState("error");
      setMsg("This link is missing its token.");
      return;
    }
    verifyEmail(token)
      .then(() => setState("ok"))
      .catch((e) => {
        setState("error");
        setMsg(e instanceof Error ? e.message : "Verification failed.");
      });
  }, []);

  return (
    <div style={{ maxWidth: 440 }}>
      <h1>Email verification</h1>
      {state === "working" && <p style={{ color: "#9aa4b2" }}>Verifying…</p>}
      {state === "ok" && (
        <p style={{ color: "#4ade80" }}>
          ✅ Your email is verified. You can close this tab or{" "}
          <Link href="/dashboard" style={{ color: "#8ab4ff" }}>
            go to your dashboard
          </Link>
          .
        </p>
      )}
      {state === "error" && (
        <p style={{ color: "#ff6b6b" }}>
          {msg} The link may have expired — request a new one from your dashboard.
        </p>
      )}
    </div>
  );
}
