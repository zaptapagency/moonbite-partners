"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import {
  createOrder,
  createReview,
  formatProductPrice,
  getProduct,
  listReviews,
  type ProductSummary,
  type RatingAggregate,
  type Review,
} from "../../../lib/api";

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

/** Row of 5 stars using the design-system `.stars` classes. */
function StarRow({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="stars" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < full ? "on" : "off"}>
          ★
        </span>
      ))}
    </span>
  );
}

function Stars({ rating }: { rating: RatingAggregate }) {
  if (!rating || rating.count === 0) {
    return <span className="muted" style={{ fontSize: 14 }}>No reviews yet</span>;
  }
  const avg = rating.average ?? 0;
  return (
    <span className="stars">
      <StarRow value={avg} />{" "}
      <span className="muted" style={{ fontWeight: 700 }}>
        {avg.toFixed(1)} ({rating.count})
      </span>
    </span>
  );
}

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<ProductSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [email, setEmail] = useState("");
  const [pwywAmount, setPwywAmount] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Review form state.
  const [orderId, setOrderId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const [reviewOk, setReviewOk] = useState(false);

  useEffect(() => {
    getProduct(id)
      .then(setProduct)
      .catch(() => setProduct(null));
    listReviews(id)
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [id]);

  // PWYW floor in whole MBITE (minPriceMbite, else the product's priceMbite).
  const pwywFloorCoins = product?.pwyw
    ? Number(BigInt(product.minPriceMbite ?? product.priceMbite)) / 1e8
    : 0;

  async function buy() {
    setBusy(true);
    setErr(null);
    try {
      let chosenAmountUnits: number | undefined;
      if (product?.pwyw) {
        const coins = parseFloat(pwywAmount);
        if (!Number.isFinite(coins) || coins <= 0) {
          throw new Error("Name your price to continue");
        }
        if (coins < pwywFloorCoins) {
          throw new Error(`Minimum is ${pwywFloorCoins} MBITE`);
        }
        chosenAmountUnits = Math.round(coins * 1e8);
      }
      const { checkoutUrl } = await createOrder(
        id,
        email || undefined,
        chosenAmountUnits,
        discountCode || undefined,
      );
      router.push(checkoutUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewBusy(true);
    setReviewErr(null);
    setReviewOk(false);
    try {
      await createReview(id, {
        orderId: orderId.trim(),
        rating,
        comment: comment.trim() || undefined,
      });
      setReviewOk(true);
      setOrderId("");
      setComment("");
      setRating(5);
      // Refresh list + aggregate.
      const [fresh, freshProduct] = await Promise.all([
        listReviews(id),
        getProduct(id).catch(() => product),
      ]);
      setReviews(fresh);
      if (freshProduct) setProduct(freshProduct);
    } catch (e) {
      setReviewErr(e instanceof Error ? e.message : "Could not submit review");
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 28 }}>
      {/* --- Product header: big cover + title/price --- */}
      <section
        style={{
          display: "grid",
          gap: 24,
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          alignItems: "start",
        }}
      >
        <div
          className="pcard-cover card"
          style={{
            borderRadius: "var(--radius)",
            ...(product?.imageUrl
              ? { backgroundImage: `url(${product.imageUrl})` }
              : {}),
          }}
        >
          {!product?.imageUrl && <span aria-hidden>🌙</span>}
        </div>

        <div className="stack">
          {product?.category && (
            <span className="pill pill-sky" style={{ alignSelf: "flex-start" }}>
              {product.category}
            </span>
          )}
          <h1 className="h1" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
            {product ? product.title : "Checkout"}
          </h1>
          {product?.merchant && (
            <div className="muted" style={{ fontWeight: 700, fontSize: 14 }}>
              by {product.merchant.displayName}
            </div>
          )}
          {product && <Stars rating={product.rating} />}
          {product?.description && <p className="lead">{product.description}</p>}
          {product && !product.pwyw && (
            <span className="pill pill-pink" style={{ alignSelf: "flex-start", fontSize: 18, padding: "8px 18px" }}>
              {formatProductPrice(product)}
            </span>
          )}
          {product?.pwyw && (
            <span className="pill pill-yellow" style={{ alignSelf: "flex-start" }}>
              Pay what you want · minimum {pwywFloorCoins} MBITE
            </span>
          )}
        </div>
      </section>

      {/* --- One-click checkout (Gumroad style) --- */}
      <section className="panel stack" style={{ maxWidth: 480 }}>
        {product?.pwyw && (
          <div>
            <label className="label">Name your price (MBITE)</label>
            <input
              className="input"
              value={pwywAmount}
              onChange={(e) => setPwywAmount(e.target.value)}
              placeholder={`${pwywFloorCoins} or more`}
              inputMode="decimal"
            />
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
              Minimum {pwywFloorCoins} MBITE.
            </p>
          </div>
        )}

        {err && (
          <div className="banner banner-danger" style={{ padding: 14 }}>
            <strong>{err}</strong>
          </div>
        )}

        <button
          className="btn btn-accent btn-block"
          onClick={buy}
          disabled={busy}
          style={{ fontSize: 18, padding: "16px 20px" }}
        >
          {busy
            ? "Creating invoice…"
            : product && !product.pwyw
              ? `I want this! — ${formatProductPrice(product)}`
              : "I want this!"}
        </button>

        <p className="muted" style={{ fontSize: 13, margin: 0, textAlign: "center" }}>
          One click. We generate a one-time MBITE address, confirm your payment,
          then deliver instantly.
        </p>

        {!showExtras ? (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowExtras(true)}
            style={{ alignSelf: "center" }}
          >
            Add email or discount code
          </button>
        ) : (
          <div className="stack">
            <div>
              <label className="label">Delivery email (optional)</label>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="label">Discount code (optional)</label>
              <input
                className="input"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="SAVE10"
              />
            </div>
          </div>
        )}
      </section>

      {/* --- Reviews --- */}
      <section className="stack">
        <div className="row">
          <h2 className="h2" style={{ fontSize: 26 }}>Reviews</h2>
          {product && <Stars rating={product.rating} />}
        </div>

        {reviews.length === 0 && (
          <p className="muted">No reviews yet. Be the first.</p>
        )}
        <div className="stack" style={{ gap: 12 }}>
          {reviews.map((r) => (
            <div key={r.id} className="card card-pad">
              <StarRow value={r.rating} />
              {r.comment && (
                <p style={{ margin: "8px 0 4px" }}>{r.comment}</p>
              )}
              <div className="muted" style={{ fontSize: 12 }}>
                {r.buyerRef ? `${r.buyerRef} · ` : ""}
                {new Date(r.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        {/* --- Leave a review --- */}
        <form
          onSubmit={submitReview}
          className="panel stack"
          style={{ maxWidth: 480 }}
        >
          <h3 className="h3">Leave a review</h3>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Reviews are gated on a fulfilled order. Paste the order id from your
            purchase to verify it.
          </p>

          <div>
            <label className="label">Order id</label>
            <input
              className="input"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="order_…"
              required
            />
          </div>

          <div>
            <label className="label">Rating</label>
            <select
              className="select"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)} ({n})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Comment (optional)</label>
            <textarea
              className="textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you think?"
              rows={3}
              style={{ resize: "vertical" }}
            />
          </div>

          {reviewErr && (
            <div className="banner banner-danger" style={{ padding: 14 }}>
              <strong>{reviewErr}</strong>
            </div>
          )}
          {reviewOk && (
            <div className="banner banner-success" style={{ padding: 14 }}>
              <strong>Thanks — your review was posted.</strong>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-ink btn-block"
            disabled={reviewBusy || !orderId.trim()}
          >
            {reviewBusy ? "Submitting…" : "Submit review"}
          </button>
        </form>
      </section>
    </div>
  );
}
