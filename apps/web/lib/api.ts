import type { CreateOrderResult, InvoiceView } from "@moonbite/shared";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Aggregate buyer rating the API attaches to every product row (Phase 2). */
export interface RatingAggregate {
  count: number;
  average: number | null;
}

export interface ProductSummary {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null; // cover image URL (null when none set)
  priceMbite: string; // BigInt serialized as string by the API
  priceCurrency?: string;
  displayUsd?: string | null; // USD price when priceCurrency === "USD"
  /** Pay-what-you-want: buyer names a price at/above minPriceMbite. */
  pwyw?: boolean;
  /** Minimum acceptable PWYW price, smallest MBITE unit (BigInt as string). */
  minPriceMbite?: string | null;
  merchant: { displayName: string };
  rating: RatingAggregate;
}

function mbiteCoins(priceMbite: string): number {
  try {
    return Number(BigInt(priceMbite)) / 1e8;
  } catch {
    return NaN;
  }
}

function fmtCoins(coins: number): string {
  // trim trailing zeros, up to 8 dp
  return coins.toFixed(8).replace(/\.?0+$/, "");
}

/**
 * MBITE-native price string. MBITE is the only currency — no fiat estimate.
 */
export function formatProductPrice(p: { priceMbite: string }): string {
  const coins = mbiteCoins(p.priceMbite);
  return Number.isNaN(coins) ? `${p.priceMbite}` : `${fmtCoins(coins)} MBITE`;
}

/** Optional catalog filters (Phase 2 discovery). */
export interface ProductQuery {
  q?: string;
  category?: string;
}

export async function listProducts(
  query: ProductQuery = {},
): Promise<ProductSummary[]> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.category?.trim()) params.set("category", query.category.trim());
  const qs = params.toString();
  const res = await fetch(`${BASE}/products${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load products");
  return res.json();
}

export async function listCategories(): Promise<string[]> {
  const res = await fetch(`${BASE}/products/categories`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json();
}

export async function getProduct(id: string): Promise<ProductSummary> {
  const res = await fetch(`${BASE}/products/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load product");
  return res.json();
}

/** A buyer review as returned by the API (newest first). */
export interface Review {
  id: string;
  productId: string;
  orderId: string;
  rating: number;
  comment: string | null;
  buyerRef: string | null;
  createdAt: string;
}

export async function listReviews(productId: string): Promise<Review[]> {
  const res = await fetch(`${BASE}/products/${productId}/reviews`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load reviews");
  return res.json();
}

export async function createReview(
  productId: string,
  input: { orderId: string; rating: number; comment?: string },
): Promise<Review> {
  const res = await fetch(`${BASE}/products/${productId}/reviews`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const message = await res
      .json()
      .then((b) => (Array.isArray(b?.message) ? b.message.join(", ") : b?.message))
      .catch(() => null);
    throw new Error(message || "Failed to submit review");
  }
  return res.json();
}

export async function createOrder(
  productId: string,
  buyerRef?: string,
  /** PWYW chosen amount in smallest MBITE units (1 MBITE = 1e8). */
  chosenAmountUnits?: number,
  /** Optional discount / coupon code. */
  discountCode?: string,
): Promise<CreateOrderResult> {
  const res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productId,
      buyerRef,
      chosenAmountUnits,
      discountCode: discountCode?.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const message = await res
      .json()
      .then((b) => (Array.isArray(b?.message) ? b.message.join(", ") : b?.message))
      .catch(() => null);
    throw new Error(message || "Failed to create order");
  }
  return res.json();
}

export async function getInvoice(orderId: string): Promise<InvoiceView> {
  const res = await fetch(`${BASE}/orders/${orderId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load invoice");
  return res.json();
}

/** What the buyer received once FULFILLED. Shape varies by delivery method. */
export interface Entitlement {
  /** LICENSE_KEY */
  key?: string;
  /** SIGNED_DOWNLOAD — a fresh short-lived URL is minted on each fetch */
  objectKey?: string;
  downloadUrl?: string;
  /** WEBHOOK */
  webhook?: { delivered: boolean; status?: number; attempts?: number; deliveredAt?: string };
  /** COURSE_ACCESS */
  access?: string;
  courseRef?: string;
  [k: string]: unknown;
}

export async function getEntitlement(orderId: string): Promise<Entitlement> {
  const res = await fetch(`${BASE}/orders/${orderId}/entitlement`, { cache: "no-store" });
  if (!res.ok) throw new Error("Entitlement not ready");
  return res.json();
}
