"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatProductPrice } from "../../lib/api";
import { getStorefront, type Storefront } from "../../lib/storefront";

export default function StorefrontPage() {
  const params = useParams<{ handle: string }>();
  const handle = typeof params.handle === "string" ? params.handle : "";
  const [store, setStore] = useState<Storefront | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "not-found" | "error">(
    "loading",
  );

  useEffect(() => {
  }, []);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    setStatus("loading");
    getStorefront(handle)
      .then((s) => {
        if (cancelled) return;
        if (!s) {
          setStatus("not-found");
          return;
        }
        setStore(s);
        setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (status === "loading") return <p className="muted">Loading storefront…</p>;
  if (status === "error")
    return (
      <div className="banner banner-danger">
        <strong>Could not reach the API. Is it running on :4000?</strong>
      </div>
    );
  if (status === "not-found" || !store)
    return (
      <div className="stack">
        <h1 className="h1">Storefront not found</h1>
        <p className="muted">
          No creator owns <strong>/{handle}</strong> yet.{" "}
          <Link href="/" style={{ fontWeight: 700 }}>
            Browse the catalog →
          </Link>
        </p>
      </div>
    );

  const { merchant, products } = store;
  const initial = (merchant.displayName || merchant.handle || "?").charAt(0).toUpperCase();

  return (
    <div className="stack" style={{ gap: 28 }}>
      {/* Creator banner */}
      <div className="panel row" style={{ gap: 20 }}>
        {merchant.avatarUrl ? (
          <div
            className="avatar"
            style={{ backgroundImage: `url(${merchant.avatarUrl})` }}
            aria-label={merchant.displayName}
          />
        ) : (
          <div className="avatar">{initial}</div>
        )}
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <h1 className="h1" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
            {merchant.displayName}
          </h1>
          {merchant.handle && (
            <div className="muted" style={{ fontWeight: 800 }}>@{merchant.handle}</div>
          )}
          {merchant.bio && (
            <p className="muted" style={{ margin: "10px 0 0", maxWidth: 640 }}>
              {merchant.bio}
            </p>
          )}
        </div>
      </div>

      <div className="row">
        <h2 className="h2">Products</h2>
        {products.length > 0 && (
          <span className="pill">{products.length}</span>
        )}
      </div>

      {products.length === 0 ? (
        <p className="muted">No products listed yet.</p>
      ) : (
        <div className="grid-cards">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="card pcard"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="pcard-cover"
                style={
                  p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined
                }
              >
                {!p.imageUrl && <span aria-hidden>🌙</span>}
              </div>
              <div className="pcard-body">
                <h3 className="h3">{p.title}</h3>
                {p.category && (
                  <span className="pill pill-sky" style={{ alignSelf: "flex-start" }}>
                    {p.category}
                  </span>
                )}
                <div className="price" style={{ marginTop: "auto" }}>
                  {formatProductPrice(p)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
