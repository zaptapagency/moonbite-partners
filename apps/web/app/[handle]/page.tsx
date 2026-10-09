"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatProductPrice } from "../../lib/api";
import { getStorefront, type Storefront } from "../../lib/storefront";

const ACCENT = "#8ab4ff";

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

  if (status === "loading") return <p style={{ color: "#9aa4b2" }}>Loading storefront…</p>;
  if (status === "error")
    return (
      <p style={{ color: "#ff6b6b" }}>
        Could not reach the API. Is it running on :4000?
      </p>
    );
  if (status === "not-found" || !store)
    return (
      <div>
        <h1>Storefront not found</h1>
        <p style={{ color: "#9aa4b2" }}>
          No creator owns <strong>/{handle}</strong> yet.{" "}
          <Link href="/" style={{ color: ACCENT, textDecoration: "none" }}>
            Browse the catalog →
          </Link>
        </p>
      </div>
    );

  const { merchant, products } = store;
  const initial = (merchant.displayName || merchant.handle || "?").charAt(0).toUpperCase();

  return (
    <div>
      {/* Creator banner */}
      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "center",
          padding: 24,
          borderRadius: 16,
          border: "1px solid #1c2230",
          background: "#111622",
          marginBottom: 28,
          flexWrap: "wrap",
        }}
      >
        {merchant.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={merchant.avatarUrl}
            alt={merchant.displayName}
            width={88}
            height={88}
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              objectFit: "cover",
              border: `2px solid ${ACCENT}`,
              background: "#0b0e14",
            }}
          />
        ) : (
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              color: "#0b0e14",
              background: ACCENT,
            }}
          >
            {initial}
          </div>
        )}
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <h1 style={{ margin: "0 0 4px" }}>{merchant.displayName}</h1>
          {merchant.handle && (
            <div style={{ color: ACCENT, fontSize: 14 }}>@{merchant.handle}</div>
          )}
          {merchant.bio && (
            <p style={{ color: "#9aa4b2", margin: "10px 0 0", maxWidth: 640 }}>
              {merchant.bio}
            </p>
          )}
        </div>
      </div>

      <h2 style={{ marginTop: 0 }}>
        Products {products.length > 0 && <span style={{ color: "#7c8699" }}>({products.length})</span>}
      </h2>

      {products.length === 0 ? (
        <p style={{ color: "#9aa4b2" }}>No products listed yet.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
            marginTop: 8,
          }}
        >
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                border: "1px solid #1c2230",
                borderRadius: 12,
                background: "#111622",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  aspectRatio: "16 / 9",
                  background: "#0b0e14",
                  borderBottom: "1px solid #1c2230",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: 32 }}>🌙</span>
                )}
              </div>
              <div style={{ padding: 16 }}>
                <h3 style={{ margin: "0 0 6px" }}>{p.title}</h3>
                {p.category && (
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 11,
                      color: ACCENT,
                      background: "#16203a",
                      borderRadius: 999,
                      padding: "2px 10px",
                      marginBottom: 8,
                    }}
                  >
                    {p.category}
                  </span>
                )}
                <div style={{ fontWeight: 700 }}>
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
