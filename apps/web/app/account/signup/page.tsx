"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerBuyer } from "../../../lib/buyer";

export default function BuyerSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit() {
    if (password.length < 8) {
      setState("error");
      setMsg("Password must be at least 8 characters.");
      return;
    }
    setState("working");
    try {
      await registerBuyer(email, password);
      router.push("/library");
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Sign up failed.");
    }
  }

  return (
    <div className="card card-pad stack" style={{ maxWidth: 440, margin: "0 auto" }}>
      <div>
        <h1 className="h2">Create your account</h1>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          Access every purchase in one place. Already bought as a guest? Sign up with the same email
          to claim your orders.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="signup-email">
          Email
        </label>
        <input
          id="signup-email"
          className="input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="signup-password">
          Password
        </label>
        <input
          id="signup-password"
          className="input"
          type="password"
          autoComplete="new-password"
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
        {state === "working" ? "Creating…" : "Create account"}
      </button>

      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        Already have an account?{" "}
        <Link href="/account/login" style={{ fontWeight: 700 }}>
          Log in
        </Link>
      </p>
    </div>
  );
}
