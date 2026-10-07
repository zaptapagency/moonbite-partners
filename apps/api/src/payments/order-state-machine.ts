import { OrderStatus, isTerminal } from "@moonbite/shared";
import { classifyPayment } from "../common/money";

/** Everything the transition decision needs — current state + observed chain facts. */
export interface ReconcileInput {
  current: OrderStatus;
  /** Has the price-quote window elapsed? */
  quoteExpired: boolean;
  /** Amount owed, smallest MBITE unit. */
  amountUnits: bigint;
  /** Amount observed on-chain for the order's address, smallest MBITE unit. */
  receivedUnits: bigint;
  /** Confirmations on the funding tx (0 = mempool / unconfirmed). */
  confirmations: number;
  requiredConfirmations: number;
  /** Under/overpayment tolerance as a fraction (0.02 = 2%). */
  tolerance: number;
}

/**
 * Pure transition function for the order / invoice state machine (PLAN.md §4).
 *
 * No I/O: given the current state and observed chain facts, it returns the next
 * status. All the real policy lives here so it can be unit-tested without a DB
 * or a node. `PaymentsService.reconcile` is the thin I/O adapter around it.
 *
 * Invariants:
 *  - Terminal states never move.
 *  - Forward progress only, with one deliberate exception: a payment that drops
 *    below tolerance (reorg / RBF) can move DETECTED → UNDERPAID, reflecting reality.
 *  - A payment that has actually arrived is honored even if the quote expired.
 */
export function decideNextStatus(input: ReconcileInput): OrderStatus {
  const { current } = input;

  if (isTerminal(current)) return current;

  // --- No funds observed yet ---
  if (input.receivedUnits <= 0n) {
    if (current === OrderStatus.AWAITING_PAYMENT && input.quoteExpired) {
      return OrderStatus.EXPIRED;
    }
    return current; // keep waiting
  }

  // --- Funds observed ---
  const band = classifyPayment(input.amountUnits, input.receivedUnits, input.tolerance);
  if (band === "under") return OrderStatus.UNDERPAID;

  // band is "ok" or "over" → deliverable once it has enough confirmations.
  if (input.confirmations >= input.requiredConfirmations) return OrderStatus.PAID;
  return OrderStatus.DETECTED;
}
