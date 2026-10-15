"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listCategories,
  listProducts,
  type ProductSummary,
} from "../lib/api";
import ProductCard from "../components/ProductCard";

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
    <div className="stack" style={{ gap: "var(--space-section)" }}>
      {/* Hero */}
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="pill pill-yellow" style={{ alignSelf: "flex-start" }}>
              ⚡ Paid in MBITE · non-custodial
            </span>
            <h1 className="h1">
              Sell digital products.
              <br />
              Get paid in <span style={{ background: "var(--pink)", padding: "0 .12em", borderRadius: 8, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>MBITE</span>.
            </h1>
            <p className="lead">
              Launch a storefront and start earning in minutes. No chargebacks,
              no middleman — payments settle straight to your own wallet, on-chain.
            </p>
            <div className="row">
              <Link href="/dashboard" className="btn btn-accent btn-lg">
                Start selling →
              </Link>
              <a href="#catalog" className="btn btn-lg">
                Browse the catalog
              </a>
            </div>
          </div>
          <div className="hero-art">
            <div className="card card-pad" style={{ background: "#fff" }}>
              <div className="eyebrow">Today</div>
              <div className="pay-amount" style={{ fontSize: 34 }}>+12.5 MBITE</div>
              <div className="muted" style={{ fontSize: 13 }}>settled to your wallet · 0 fees held</div>
            </div>
            <div className="card card-pad" style={{ background: "var(--yellow)" }}>
              <div className="row" style={{ gap: 10 }}>
                <span style={{ fontSize: 26 }}>🔑</span>
                <div>
                  <div className="h4">Instant delivery</div>
                  <div style={{ fontSize: 13 }}>Keys, downloads &amp; access on confirm.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="feature-row">
        <div className="feature">
          <span className="ico" aria-hidden>🛡️</span>
          <div>
            <div className="h4">Non-custodial</div>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
              Funds go buyer → your wallet. We never hold your money.
            </p>
          </div>
        </div>
        <div className="feature">
          <span className="ico" aria-hidden>⚡</span>
          <div>
            <div className="h4">Instant settlement</div>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
              On-chain confirmation delivers the product automatically.
            </p>
          </div>
        </div>
        <div className="feature">
          <span className="ico" aria-hidden>🚫</span>
          <div>
            <div className="h4">No chargebacks</div>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
              Crypto-final payments — what you earn stays earned.
            </p>
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="stack-lg" style={{ scrollMarginTop: 90 }}>
        <div className="section-head">
          <div>
            <span className="eyebrow">Marketplace</span>
            <h2 className="h2">Discover products</h2>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <input
              className="input input-pill"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              style={{ flex: "1 1 220px", minWidth: 180 }}
            />
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
              style={{ flex: "0 1 190px", borderRadius: 999 }}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="banner banner-danger">
            <strong>{error}</strong>
          </div>
        )}
        {!error && !loading && products.length === 0 && (
          <div className="empty">
            <div style={{ fontSize: 32 }}>🌙</div>
            <p style={{ margin: "8px 0 0", fontWeight: 700 }}>No products match</p>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Try clearing the search or category filter.
            </p>
          </div>
        )}

        {loading && products.length === 0 && !error ? (
          <div className="grid-cards">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card pcard" aria-hidden>
                <div className="skeleton" style={{ aspectRatio: "16 / 10", borderRadius: 0 }} />
                <div className="pcard-body">
                  <div className="skeleton" style={{ height: 12, width: "40%" }} />
                  <div className="skeleton" style={{ height: 18, width: "80%" }} />
                  <div className="skeleton" style={{ height: 12, width: "100%" }} />
                  <div className="skeleton" style={{ height: 34, width: "100%", marginTop: 8 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="grid-cards"
            style={{ opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}
          >
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                showMerchant
                showRating
                showDescription
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
