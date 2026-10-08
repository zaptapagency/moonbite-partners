import type { OrderStatus } from "./order-status";

/** How a paid product reaches the buyer (see PLAN.md §6). */
export const DeliveryMethod = {
  LICENSE_KEY: "LICENSE_KEY",
  SIGNED_DOWNLOAD: "SIGNED_DOWNLOAD",
  WEBHOOK: "WEBHOOK",
  COURSE_ACCESS: "COURSE_ACCESS",
} as const;
export type DeliveryMethod =
  (typeof DeliveryMethod)[keyof typeof DeliveryMethod];

/** Merchant verification tier → fee + caps (see PLAN.md §5.2). */
export const MerchantTier = {
  STARTER: "STARTER",
  VERIFIED: "VERIFIED",
  ELITE: "ELITE",
} as const;
export type MerchantTier = (typeof MerchantTier)[keyof typeof MerchantTier];

/** Amounts are integers in the smallest MBITE unit ("satoshi") to avoid float drift. */
export type MbiteAmount = bigint;

/** What the checkout page needs to render a payment request. */
export interface InvoiceView {
  orderId: string;
  status: OrderStatus;
  /** Freshly derived, unique per order. */
  payToAddress: string;
  /** Exact amount owed, in smallest MBITE unit, serialized as a decimal string. */
  amountMbite: string;
  /** Human price the merchant set (may be MBITE-native or USD estimate). */
  displayPrice: string;
  confirmations: number;
  requiredConfirmations: number;
  /** Unix ms when the quote (and address reuse guarantee) expires. */
  expiresAt: number;
  /** Pricing currency the merchant set: "MBITE" native, or "USD" converted at quote time. */
  priceCurrency?: "MBITE" | "USD";
  /** The USD price the merchant set, present only when priceCurrency === "USD". */
  displayUsd?: number;
  /** MBITE-per-USD rate locked at quote time, present only when priceCurrency === "USD". */
  mbitePerUsd?: number;
}

/** Response of POST /orders — the thing the buyer is redirected to pay. */
export interface CreateOrderResult {
  orderId: string;
  checkoutUrl: string;
}
