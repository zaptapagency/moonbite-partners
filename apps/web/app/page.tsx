"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatProductPrice,
  getUsdPerMbite,
  listCategories,
  listProducts,
  type ProductSummary,
  type RatingAggregate,
} from "../lib/api";

// MBITE units (1e8) → display string.
function fmtMbite(units: string): string {
  try {
    const u = BigInt(units);
    const whole = u / 100_000_000n;
    const frac = (u % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return units;
  }
}

/** ★ average + (count), or a muted "No reviews yet". */
function Stars({ rating, size = 14 }: { rating: RatingAggregate; size?: number }) {
  if (!rating || rating.count === 0) {
    return <span style={{ color: "#5c6577", fontSize: size }}>No reviews yet</span>;
  }
  const avg = rating.average ?? 0;
  const full = Math.round(avg);
  return (
    <span style={{ fontSize: size, color: "#f5c451" }}>
      <span aria-hidden>{"★".repeat(full)}</span>
      <span aria-hidden style={{ color: "#3a4151" }}>{"★".repeat(5 - full)}</span>{" "}
      <span style={{ color: "#9aa4b2" }}>
        {avg.toFixed(1)} ({rating.count})
      </span>
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #2a3344",
  background: "#0b0e14",
  color: "#e6e8ec",
};

export default function CatalogPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [usdPerMbite, setUsdPerMbite] = useState<number | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load the category list + display rate once.
  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
    getUsdPerMbite().then(setUsdPerMbite);
  }, []);

  // Refetch whenever the search text or category changes (debounced on q).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      listProducts({ q, category })
        .then((rows) => {
          if (cancelled) return;
          setProducts(rows);
          setError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setError("Could not reach the API. Is it running on :4000?");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q, category]);

  return (
    <div>
      <h1>Digital products, paid in MBITE</h1>
      <p style={{ color: "#9aa4b2" }}>
        No chargebacks. Instant on-chain settlement. (See PLAN.md §1.)
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          margin: "20px 0",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          style={{ ...inputStyle, flex: "1 1 240px", minWidth: 0 }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ ...inputStyle, flex: "0 1 200px" }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
      {!error && !loading && products.length === 0 && (
        <p style={{ color: "#9aa4b2" }}>
          No products match. Try clearing the search or category filter.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 8,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {products.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #1c2230",
              borderRadius: 12,
              padding: 16,
              background: "#111622",
            }}
          >
            <div style={{ fontSize: 12, color: "#7c8699" }}>{p.merchant.displayName}</div>
            <h3 style={{ margin: "4px 0" }}>{p.title}</h3>
            {p.category && (
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  color: "#8ab4ff",
                  background: "#16203a",
                  borderRadius: 999,
                  padding: "2px 10px",
                  marginBottom: 6,
                }}
              >
                {p.category}
              </span>
            )}
            <p style={{ color: "#9aa4b2", minHeight: 40 }}>{p.description}</p>
            <div style={{ marginBottom: 6 }}>
              <Stars rating={p.rating} />
            </div>
            <strong>{formatProductPrice(p, usdPerMbite)}</strong>
            <div style={{ marginTop: 12 }}>
              <Link
                href={`/product/${p.id}`}
                style={{ color: "#8ab4ff", textDecoration: "none" }}
              >
                Buy →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
