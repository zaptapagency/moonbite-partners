import { validateDiscountInput } from "./discount-validation";

const now = new Date("2026-01-01T00:00:00.000Z");
const future = "2026-06-01T00:00:00.000Z";
const past = "2025-01-01T00:00:00.000Z";

describe("validateDiscountInput", () => {
  it("accepts a percent-off code and normalizes it", () => {
    const r = validateDiscountInput({ code: " SAVE10 ", percentOff: 10 }, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({
        code: "SAVE10",
        percentOff: 10,
        amountOffUnits: null,
        maxRedemptions: null,
        expiresAt: null,
      });
    }
  });

  it("accepts a fixed amount-off code", () => {
    const r = validateDiscountInput({ code: "FLAT", amountOffUnits: 50_000_000 }, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.amountOffUnits).toBe(50_000_000);
      expect(r.value.percentOff).toBeNull();
    }
  });

  it("requires a non-empty code", () => {
    expect(validateDiscountInput({ code: "   ", percentOff: 10 }, now)).toMatchObject({
      ok: false,
      code: "bad_code",
    });
    expect(validateDiscountInput({ percentOff: 10 }, now)).toMatchObject({
      ok: false,
      code: "bad_code",
    });
  });

  it("requires exactly one of percentOff or amountOffUnits", () => {
    expect(validateDiscountInput({ code: "X" }, now)).toMatchObject({
      ok: false,
      code: "no_value",
    });
    expect(
      validateDiscountInput({ code: "X", percentOff: 10, amountOffUnits: 5 }, now),
    ).toMatchObject({ ok: false, code: "both_values" });
  });

  it("rejects out-of-range or non-integer percentOff", () => {
    for (const p of [0, 101, -5, 10.5, Number.NaN]) {
      expect(validateDiscountInput({ code: "X", percentOff: p }, now)).toMatchObject({
        ok: false,
        code: "bad_percent",
      });
    }
    for (const p of [1, 50, 100]) {
      expect(validateDiscountInput({ code: "X", percentOff: p }, now).ok).toBe(true);
    }
  });

  it("rejects non-positive or non-integer amountOffUnits", () => {
    for (const a of [0, -1, 1.5, Number.NaN]) {
      expect(validateDiscountInput({ code: "X", amountOffUnits: a }, now)).toMatchObject({
        ok: false,
        code: "bad_amount",
      });
    }
  });

  it("validates optional maxRedemptions", () => {
    expect(
      validateDiscountInput({ code: "X", percentOff: 10, maxRedemptions: 0 }, now),
    ).toMatchObject({ ok: false, code: "bad_max_redemptions" });
    expect(
      validateDiscountInput({ code: "X", percentOff: 10, maxRedemptions: 5 }, now).ok,
    ).toBe(true);
  });

  it("validates optional expiry (future only, must parse)", () => {
    expect(
      validateDiscountInput({ code: "X", percentOff: 10, expiresAt: "not-a-date" }, now),
    ).toMatchObject({ ok: false, code: "bad_expiry" });
    expect(
      validateDiscountInput({ code: "X", percentOff: 10, expiresAt: past }, now),
    ).toMatchObject({ ok: false, code: "bad_expiry" });
    const r = validateDiscountInput({ code: "X", percentOff: 10, expiresAt: future }, now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.expiresAt).toEqual(new Date(future));
  });

  it("treats a blank expiry string as unset", () => {
    const r = validateDiscountInput({ code: "X", percentOff: 10, expiresAt: "  " }, now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.expiresAt).toBeNull();
  });
});
