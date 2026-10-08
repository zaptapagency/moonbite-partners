"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginBuyer } from "../../../lib/buyer";

export default function BuyerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit() {
    setState("working");
    try {
      await loginBuyer(email, password);
      router.push("/library");
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Login failed.");
    }
  }

  return (
    <div style={panel}>
      <h1 style={{ marginTop: 0 }}>Log in</h1>
      <p style={{ color: "#9aa4b2", marginTop: -6 }}>Access your purchase library.</p>
      <label style={label}>
        Email
        <input
          style={input}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label style={label}>
        Password
        <input
          style={input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </label>
      {state === "error" && <p style={{ color: "#ff6b6b" }}>{msg}</p>}
      <button onClick={submit} disabled={state === "working"} style={button}>
        {state === "working" ? "Signing in…" : "Log in"}
      </button>
      <p style={{ color: "#9aa4b2", fontSize: 14, marginBottom: 0 }}>
        No account yet?{" "}
        <Link href="/account/signup" style={{ color: "#8ab4ff" }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}

const panel: React.CSSProperties = {
  maxWidth: 440,
  margin: "0 auto",
  background: "#111622",
  border: "1px solid #1c2230",
  borderRadius: 12,
  padding: 24,
};
const label: React.CSSProperties = { display: "block", marginTop: 14, fontSize: 14 };
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
const button: React.CSSProperties = {
  marginTop: 18,
  width: "100%",
  padding: "11px 18px",
  borderRadius: 8,
  border: "none",
  background: "#8ab4ff",
  color: "#0b0e14",
  fontWeight: 700,
  cursor: "pointer",
};
