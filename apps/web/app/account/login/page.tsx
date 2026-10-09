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
    <div className="card card-pad stack" style={{ maxWidth: 440, margin: "0 auto" }}>
      <div>
        <h1 className="h2">Log in</h1>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          Access your purchase library.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>

      {state === "error" && <div className="banner banner-danger">{msg}</div>}

      <button
        onClick={submit}
        disabled={state === "working"}
        className="btn btn-accent btn-block"
      >
        {state === "working" ? "Signing in…" : "Log in"}
      </button>

      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        No account yet?{" "}
        <Link href="/account/signup" style={{ fontWeight: 700 }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
