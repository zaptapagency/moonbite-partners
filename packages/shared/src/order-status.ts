/**
 * The order / invoice state machine. This is the spine of the platform
 * (see PLAN.md §4). States move forward only; terminal states are
 * FULFILLED, EXPIRED, REFUNDED, CANCELLED.
 *
 *   AWAITING_PAYMENT ──tx seen──▶ DETECTED ──N confs──▶ PAID ──deliver──▶ FULFILLED
 *          │                         │                    │
 *          │ quote expires           │ wrong amount       │ delivery fails (retry)
 *          ▼                         ▼                    ▼
 *       EXPIRED                  UNDERPAID / OVERPAID   (stays PAID, alert)
 */
export const OrderStatus = {
  /** Invoice created, address derived, waiting for an incoming tx. */
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  /** A matching tx hit the address but confirmations < threshold (0-conf). */
  DETECTED: "DETECTED",
  /** Paid amount below tolerance band — needs top-up or refund. */
  UNDERPAID: "UNDERPAID",
  /** Paid amount above tolerance band — delivered, credit recorded. */
  OVERPAID: "OVERPAID",
  /** Confirmed at/above the required depth. Safe to deliver. */
  PAID: "PAID",
  /** Product delivered to the buyer. Terminal (happy path). */
  FULFILLED: "FULFILLED",
  /** Quote window elapsed with no (sufficient) payment. Terminal. */
  EXPIRED: "EXPIRED",
  /** Merchant sent funds back to the buyer's return address. Terminal. */
  REFUNDED: "REFUNDED",
  /** Cancelled before payment. Terminal. */
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Statuses from which no further transition is allowed. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  OrderStatus.FULFILLED,
  OrderStatus.EXPIRED,
  OrderStatus.REFUNDED,
  OrderStatus.CANCELLED,
];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
