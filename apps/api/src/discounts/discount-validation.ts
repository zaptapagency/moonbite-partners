/**
 * Pure discount-input validation (no I/O). A discount is well-formed only when
 * it carries a non-empty code and EXACTLY ONE of a percentOff (1..100) or a
 * fixed amountOffUnits (>= 1), with sane optional maxRedemptions / expiry.
 *
 * Kept standalone (mirrors review-eligibility) so it can be unit-tested without
 * a DB or Nest context; the service maps each rejection code onto a 400.
 */

/** Raw-ish discount fields a merchant submits (before persistence). */
export interface DiscountInput {
  code?: string;
  /** Percent off (1..100), XOR with amountOffUnits. */
  percentOff?: number | null;
  /** Fixed amount off in smallest MBITE units (>= 1), XOR with percentOff. */
  amountOffUnits?: number | null;
  /** Optional cap on total redemptions (>= 1 when set). */
  maxRedemptions?: number | null;
  /** Optional ISO expiry; must parse and be in the future when set. */
  expiresAt?: string | null;
}

/** Why a discount was rejected — maps 1:1 onto a BadRequest reason. */
export type DiscountRejectionCode =
  | "bad_code"
  | "no_value"
  | "both_values"
  | "bad_percent"
  | "bad_amount"
  | "bad_max_redemptions"
  | "bad_expiry";

/** Normalized, validated discount values ready to persist. */
export interface NormalizedDiscount {
  code: string;
  percentOff: number | null;
  amountOffUnits: number | null;
  maxRedemptions: number | null;
  expiresAt: Date | null;
}

export type DiscountValidation =
  | { ok: true; value: NormalizedDiscount }
  | { ok: false; code: DiscountRejectionCode; reason: string };

function isSet(n: number | null | undefined): n is number {
  return n != null;
}

/**
 * Validate + normalize a discount input. `now` is injectable so the expiry
 * check is deterministic in tests.
 */
export function validateDiscountInput(
  input: DiscountInput,
  now: Date = new Date(),
): DiscountValidation {
  const code = (input.code ?? "").trim();
  if (code.length === 0) {
    return { ok: false, code: "bad_code", reason: "Code is required" };
  }

  const hasPercent = isSet(input.percentOff);
  const hasAmount = isSet(input.amountOffUnits);
  if (!hasPercent && !hasAmount) {
    return {
      ok: false,
      code: "no_value",
      reason: "Provide either percentOff or amountOffUnits",
    };
  }
  if (hasPercent && hasAmount) {
    return {
      ok: false,
      code: "both_values",
      reason: "Provide only one of percentOff or amountOffUnits, not both",
    };
  }

  if (hasPercent) {
    const p = input.percentOff as number;
    if (!Number.isInteger(p) || p < 1 || p > 100) {
      return {
        ok: false,
        code: "bad_percent",
        reason: "percentOff must be an integer from 1 to 100",
      };
    }
  }

  if (hasAmount) {
    const a = input.amountOffUnits as number;
    if (!Number.isInteger(a) || a < 1) {
      return {
        ok: false,
        code: "bad_amount",
        reason: "amountOffUnits must be an integer of at least 1",
      };
    }
  }

  if (isSet(input.maxRedemptions)) {
    const m = input.maxRedemptions as number;
    if (!Number.isInteger(m) || m < 1) {
      return {
        ok: false,
        code: "bad_max_redemptions",
        reason: "maxRedemptions must be an integer of at least 1",
      };
    }
  }

  let expiresAt: Date | null = null;
  if (input.expiresAt != null && `${input.expiresAt}`.trim().length > 0) {
    const d = new Date(input.expiresAt);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, code: "bad_expiry", reason: "expiresAt is not a valid date" };
    }
    if (d.getTime() <= now.getTime()) {
      return { ok: false, code: "bad_expiry", reason: "expiresAt must be in the future" };
    }
    expiresAt = d;
  }

  return {
    ok: true,
    value: {
      code,
      percentOff: hasPercent ? (input.percentOff as number) : null,
      amountOffUnits: hasAmount ? (input.amountOffUnits as number) : null,
      maxRedemptions: isSet(input.maxRedemptions) ? (input.maxRedemptions as number) : null,
      expiresAt,
    },
  };
}
