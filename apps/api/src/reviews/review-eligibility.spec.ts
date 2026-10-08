import { OrderStatus } from "@moonbite/shared";
import { checkReviewEligibility } from "./review-eligibility";

const base = {
  orderExists: true,
  orderStatus: OrderStatus.FULFILLED as OrderStatus | string | null,
  orderProductId: "prod_1",
  targetProductId: "prod_1",
  rating: 5,
};

describe("checkReviewEligibility", () => {
  it("allows a 1..5 review on a fulfilled order for this product", () => {
    expect(checkReviewEligibility(base)).toEqual({ ok: true });
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(checkReviewEligibility({ ...base, rating })).toEqual({ ok: true });
    }
  });

  it("rejects non-integer or out-of-range ratings before anything else", () => {
    for (const rating of [0, 6, -1, 2.5, Number.NaN]) {
      const result = checkReviewEligibility({ ...base, rating });
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ code: "bad_rating" });
    }
    // bad rating is reported even when the order is missing
    expect(
      checkReviewEligibility({ ...base, orderExists: false, rating: 9 }),
    ).toMatchObject({ ok: false, code: "bad_rating" });
  });

  it("rejects when the order does not exist", () => {
    expect(
      checkReviewEligibility({ ...base, orderExists: false }),
    ).toMatchObject({ ok: false, code: "not_found" });
  });

  it("rejects when the order is for a different product", () => {
    expect(
      checkReviewEligibility({ ...base, orderProductId: "prod_other" }),
    ).toMatchObject({ ok: false, code: "product_mismatch" });
    expect(
      checkReviewEligibility({ ...base, orderProductId: null }),
    ).toMatchObject({ ok: false, code: "product_mismatch" });
  });

  it("rejects every non-FULFILLED status", () => {
    const nonFulfilled = [
      OrderStatus.AWAITING_PAYMENT,
      OrderStatus.DETECTED,
      OrderStatus.UNDERPAID,
      OrderStatus.OVERPAID,
      OrderStatus.PAID,
      OrderStatus.EXPIRED,
      OrderStatus.REFUNDED,
      OrderStatus.CANCELLED,
    ];
    for (const orderStatus of nonFulfilled) {
      expect(checkReviewEligibility({ ...base, orderStatus })).toMatchObject({
        ok: false,
        code: "not_fulfilled",
      });
    }
  });

  it("checks product match before fulfillment", () => {
    // A mismatched product on a non-fulfilled order reports the mismatch.
    expect(
      checkReviewEligibility({
        ...base,
        orderProductId: "prod_other",
        orderStatus: OrderStatus.PAID,
      }),
    ).toMatchObject({ ok: false, code: "product_mismatch" });
  });
});
