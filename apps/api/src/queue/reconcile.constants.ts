/** Shared names + job payload shapes for the reconciliation queue. */

export const RECONCILE_QUEUE = "reconcile";

export const JOB_RECONCILE_ORDER = "reconcile-order";
export const JOB_VERIFY_REFUND = "verify-refund";

export interface ReconcileOrderJob {
  orderId: string;
}

export interface VerifyRefundJob {
  refundId: string;
}
