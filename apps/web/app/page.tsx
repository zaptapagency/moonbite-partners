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
            <ProductCard
              key={p.id}
              product={p}
              showMerchant
              showRating
              showDescription
            />
          ))}
        </div>
      </section>
    </div>
  );
}
