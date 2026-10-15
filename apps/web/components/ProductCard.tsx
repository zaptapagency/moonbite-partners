"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createOrder,
  formatProductPrice,
  type RatingAggregate,
} from "../lib/api";

/** Minimal product shape any card needs to render + offer a one-click buy. */
export interface BuyableProduct {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  priceMbite: string;
  /** Pay-what-you-want items can't be one-clicked — the buyer names a price. */
  pwyw?: boolean;
  minPriceMbite?: string | null;
  merchant?: { displayName: string };
  rating?: RatingAggregate;
}

/** ★ average + (count), or a muted "No reviews yet". */
function Stars({ rating }: { rating?: RatingAggregate }) {
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

/**
 * A catalog card with a Gumroad-style one-click "I want this!" button.
 *
 * For a normal product the button creates the order and jumps straight to the
 * MBITE pay screen — no form, one click. Pay-what-you-want products link to the
 * product page instead, since the buyer must name a price first.
 */
export default function ProductCard({
  product,
  showMerchant = false,
  showRating = false,
  showDescription = false,
}: {
  product: BuyableProduct;
  showMerchant?: boolean;
  showRating?: boolean;
  showDescription?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function buyNow() {
    setBusy(true);
    setErr(null);
    try {
      const { checkoutUrl } = await createOrder(product.id);
      router.push(checkoutUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  const href = `/product/${product.id}`;

  return (
    <div className="card pcard">
      <Link
        href={href}
        className="pcard-cover"
        style={{
          textDecoration: "none",
          color: "inherit",
          ...(product.imageUrl
            ? { backgroundImage: `url(${product.imageUrl})` }
            : {}),
        }}
        aria-label={product.title}
      >
        {!product.imageUrl && <span aria-hidden>🌙</span>}
      </Link>
      <div className="pcard-body">
        {showMerchant && product.merchant && (
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
            {product.merchant.displayName}
          </div>
        )}
        <Link
          href={href}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <h3 className="h3">{product.title}</h3>
        </Link>
        {product.category && (
          <span className="pill pill-sky" style={{ alignSelf: "flex-start" }}>
            {product.category}
          </span>
        )}
        {showDescription && product.description && (
          <p className="muted" style={{ margin: 0, fontSize: 14, flex: 1 }}>
            {product.description}
          </p>
        )}
        {showRating && <Stars rating={product.rating} />}

        <div className="spread" style={{ marginTop: "auto" }}>
          <span className="price">
            {product.pwyw ? "Name your price" : formatProductPrice(product)}
          </span>
          {product.pwyw ? (
            <Link href={href} className="btn btn-sm btn-accent">
              I want this! →
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-accent"
              onClick={buyNow}
              disabled={busy}
            >
              {busy ? "Starting…" : "I want this!"}
            </button>
          )}
        </div>
        {err && (
          <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
