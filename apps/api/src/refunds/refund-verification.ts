import { classifyPayment } from "../common/money";

/** A refund tx as observed on-chain (outputs + confirmation depth). */
export interface RefundTxView {
  confirmations: number;
  outputs: Array<{ address?: string; valueUnits: bigint }>;
}

export type RefundVerdict =
  /** Pays the return address with enough value and confirmations — accept. */
  | "CONFIRMED"
  /** Pays the right address + amount but needs more confirmations — wait. */
  | "PENDING_CONFIRMATIONS"
  /** Pays the return address but less than owed — reject / ask merchant to redo. */
  | "UNDERPAID_REFUND"
  /** No output pays the expected return address — wrong tx. */
  | "WRONG_ADDRESS";

/**
 * Pure verification of a merchant-submitted refund transaction (PLAN.md §4).
 * No I/O: given what the chain shows, decide whether the refund is good.
 *
 * Sums every output paying `refundAddress` (a tx may split change), then checks
 * the total against the owed amount (within tolerance) and the confirmation depth.
 */
export function verifyRefund(
  tx: RefundTxView,
  refundAddress: string,
  amountUnits: bigint,
  requiredConfirmations: number,
  tolerance: number,
): RefundVerdict {
  const paid = tx.outputs
    .filter((o) => o.address === refundAddress)
    .reduce((sum, o) => sum + o.valueUnits, 0n);

  if (paid <= 0n) return "WRONG_ADDRESS";
  if (classifyPayment(amountUnits, paid, tolerance) === "under") {
    return "UNDERPAID_REFUND";
  }
  if (tx.confirmations < requiredConfirmations) return "PENDING_CONFIRMATIONS";
  return "CONFIRMED";
}
