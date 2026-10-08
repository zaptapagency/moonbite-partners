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

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #2a3344",
  background: "#0b0e14",
  color: "#e6e8ec",
  boxSizing: "border-box",
};

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

  async function buy() {
    setBusy(true);
    setErr(null);
    try {
      const { checkoutUrl } = await createOrder(id, email || undefined);
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
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ marginBottom: 4 }}>{product ? product.title : "Checkout"}</h1>
      {product && (
        <div style={{ marginBottom: 8 }}>
          <Stars rating={product.rating} size={16} />
        </div>
      )}
      {product?.category && (
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            color: "#8ab4ff",
            background: "#16203a",
            borderRadius: 999,
            padding: "2px 10px",
            marginBottom: 8,
          }}
        >
          {product.category}
        </span>
      )}
      {product?.description && (
        <p style={{ color: "#9aa4b2" }}>{product.description}</p>
      )}
      {product && (
        <p>
          <strong>{formatProductPrice(product)}</strong>
        </p>
      )}

      {/* --- Checkout --- */}
      <div style={{ maxWidth: 420 }}>
        <p style={{ color: "#9aa4b2" }}>
          We&apos;ll generate a one-time MBITE address and wait for your payment to
          confirm, then deliver the product automatically.
        </p>
        <label style={{ display: "block", margin: "16px 0 6px" }}>
          Delivery email (optional)
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={fieldStyle}
        />
        {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}
        <button
          onClick={buy}
          disabled={busy}
          style={{
            marginTop: 16,
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: busy ? "#2a3344" : "#8ab4ff",
            color: "#0b0e14",
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Creating invoice…" : "Pay with MBITE"}
        </button>
      </div>

      {/* --- Reviews --- */}
      <section style={{ marginTop: 40 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 12 }}>
          Reviews{" "}
          {product && <Stars rating={product.rating} size={15} />}
        </h2>

        {reviews.length === 0 && (
          <p style={{ color: "#9aa4b2" }}>No reviews yet. Be the first.</p>
        )}
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {reviews.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid #1c2230",
                borderRadius: 12,
                padding: 14,
                background: "#111622",
              }}
            >
              <div style={{ color: "#f5c451", fontSize: 14 }}>
                <span aria-hidden>{"★".repeat(r.rating)}</span>
                <span aria-hidden style={{ color: "#3a4151" }}>
                  {"★".repeat(5 - r.rating)}
                </span>
              </div>
              {r.comment && (
                <p style={{ margin: "6px 0 4px", color: "#e6e8ec" }}>{r.comment}</p>
              )}
              <div style={{ fontSize: 11, color: "#7c8699" }}>
                {r.buyerRef ? `${r.buyerRef} · ` : ""}
                {new Date(r.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        {/* --- Leave a review --- */}
        <form
          onSubmit={submitReview}
          style={{
            marginTop: 24,
            border: "1px solid #1c2230",
            borderRadius: 12,
            padding: 16,
            background: "#0f1420",
            maxWidth: 420,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Leave a review</h3>
          <p style={{ color: "#9aa4b2", fontSize: 13 }}>
            Reviews are gated on a fulfilled order. Paste the order id from your
            purchase to verify it.
          </p>

          <label style={{ display: "block", margin: "12px 0 6px" }}>Order id</label>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="order_…"
            style={fieldStyle}
            required
          />

          <label style={{ display: "block", margin: "12px 0 6px" }}>Rating</label>
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            style={fieldStyle}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} ({n})
              </option>
            ))}
          </select>

          <label style={{ display: "block", margin: "12px 0 6px" }}>
            Comment (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you think?"
            rows={3}
            style={{ ...fieldStyle, resize: "vertical" }}
          />

          {reviewErr && <p style={{ color: "#ff6b6b" }}>{reviewErr}</p>}
          {reviewOk && <p style={{ color: "#5ad18b" }}>Thanks — your review was posted.</p>}

          <button
            type="submit"
            disabled={reviewBusy || !orderId.trim()}
            style={{
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: reviewBusy || !orderId.trim() ? "#2a3344" : "#8ab4ff",
              color: "#0b0e14",
              fontWeight: 700,
              cursor: reviewBusy || !orderId.trim() ? "default" : "pointer",
            }}
          >
            {reviewBusy ? "Submitting…" : "Submit review"}
          </button>
        </form>
      </section>
    </div>
  );
}
