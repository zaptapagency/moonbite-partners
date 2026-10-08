import { OrderStatus } from "@moonbite/shared";

/** Facts needed to decide whether an order may be reviewed (Phase 2 discovery). */
export interface ReviewEligibilityInput {
  /** Did an order with the posted orderId exist? */
  orderExists: boolean;
  /** The order's current status (ignored when the order is missing). */
  orderStatus?: OrderStatus | string | null;
  /** The product the order is for (ignored when the order is missing). */
  orderProductId?: string | null;
  /** The product the review is being left on (`:id` in the route). */
  targetProductId: string;
  /** Submitted rating (must be an integer 1..5). */
  rating: number;
}

/** Why a review was rejected — maps 1:1 onto an HTTP error in the service. */
export type ReviewRejectionCode =
  | "bad_rating"
  | "not_found"
  | "product_mismatch"
  | "not_fulfilled";

export type ReviewEligibility =
  | { ok: true }
  | { ok: false; code: ReviewRejectionCode; reason: string };

/**
 * Pure review-eligibility guard (no I/O): a review is allowed only when the
 * rating is a 1..5 integer AND the order exists, is for this product, and is
 * FULFILLED. Kept standalone so it can be unit-tested without a DB. The
 * one-review-per-order rule is enforced separately by the `@unique orderId`.
 */
export function checkReviewEligibility(
  input: ReviewEligibilityInput,
): ReviewEligibility {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return {
      ok: false,
      code: "bad_rating",
      reason: "Rating must be an integer from 1 to 5",
    };
  }
  if (!input.orderExists) {
    return { ok: false, code: "not_found", reason: "Order not found" };
  }
  if (input.orderProductId !== input.targetProductId) {
    return {
      ok: false,
      code: "product_mismatch",
      reason: "That order is not for this product",
    };
  }
  if (input.orderStatus !== OrderStatus.FULFILLED) {
    return {
      ok: false,
      code: "not_fulfilled",
      reason: "Only fulfilled orders can be reviewed",
    };
  }
  return { ok: true };
}
