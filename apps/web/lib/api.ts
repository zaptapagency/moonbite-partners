import type { CreateOrderResult, InvoiceView } from "@moonbite/shared";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export interface ProductSummary {
  id: string;
  title: string;
  description: string | null;
  priceMbite: string; // BigInt serialized as string by the API
  merchant: { displayName: string };
}

export async function listProducts(): Promise<ProductSummary[]> {
  const res = await fetch(`${BASE}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load products");
  return res.json();
}

export async function createOrder(
  productId: string,
  buyerRef?: string,
): Promise<CreateOrderResult> {
  const res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId, buyerRef }),
  });
  if (!res.ok) throw new Error("Failed to create order");
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
