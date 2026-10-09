"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatProductPrice,
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
function Stars({ rating }: { rating: RatingAggregate }) {
  if (!rating || rating.count === 0) {
    return <span className="muted" style={{ fontSize: 13 }}>No reviews yet</span>;
  }
  const avg = rating.average ?? 0;
  const full = Math.round(avg);
  return (
    <span className="stars">
      <span aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < full ? "on" : "off"}>
            ★
          </span>
        ))}
      </span>{" "}
      <span className="muted" style={{ fontWeight: 700 }}>
        {avg.toFixed(1)} ({rating.count})
      </span>
    </span>
  );
}

export default function CatalogPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load the category list once.
  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
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
    <div className="stack" style={{ gap: 32 }}>
      {/* Hero */}
      <section className="panel" style={{ padding: "40px 28px" }}>
        <div className="stack" style={{ maxWidth: 680 }}>
          <span className="pill pill-pink" style={{ alignSelf: "flex-start" }}>
            Paid in MBITE
          </span>
          <h1 className="h1">Sell digital products. Get paid in MBITE.</h1>
          <p className="muted" style={{ fontSize: 18, margin: 0 }}>
            No chargebacks. Instant on-chain settlement. Launch a storefront and
            start earning in minutes. (See PLAN.md §1.)
          </p>
          <div className="row">
            <Link href="/dashboard" className="btn btn-accent">
              Start selling →
            </Link>
            <a href="#catalog" className="btn">
              Browse the catalog
            </a>
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="stack">
        <div className="spread">
          <h2 className="h2">Discover products</h2>
        </div>

        <div className="row" style={{ gap: 12 }}>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            style={{ flex: "1 1 240px", minWidth: 0 }}
          />
          <select
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ flex: "0 1 200px" }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="banner banner-danger">
            <strong>{error}</strong>
          </div>
        )}
        {!error && !loading && products.length === 0 && (
          <p className="muted">
            No products match. Try clearing the search or category filter.
          </p>
        )}

        <div
          className="grid-cards"
          style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}
        >
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
                <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                  {p.merchant.displayName}
                </div>
                <h3 className="h3">{p.title}</h3>
                {p.category && (
                  <span className="pill pill-sky" style={{ alignSelf: "flex-start" }}>
                    {p.category}
                  </span>
                )}
                <p className="muted" style={{ margin: 0, fontSize: 14, flex: 1 }}>
                  {p.description}
                </p>
                <Stars rating={p.rating} />
                <div className="spread" style={{ marginTop: 4 }}>
                  <span className="price">{formatProductPrice(p)}</span>
                  <span className="btn btn-sm btn-accent">Buy →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
