/**
 * MBITE money helpers. Internally we store the smallest unit as BigInt
 * ("satoshi", 1 MBITE = 100_000_000 units). The node RPC speaks whole-coin
 * decimals, so convert at the boundary only.
 */
export const MBITE_DECIMALS = 8;
export const UNITS_PER_MBITE = 10n ** BigInt(MBITE_DECIMALS);

/** Node decimal (e.g. 1.2345) → BigInt units. */
export function coinsToUnits(coins: number): bigint {
  // Round to avoid float artifacts (e.g. 0.1 + 0.2).
  return BigInt(Math.round(coins * Number(UNITS_PER_MBITE)));
}

/** BigInt units → decimal string for display/serialization. */
export function unitsToCoins(units: bigint): string {
  const whole = units / UNITS_PER_MBITE;
  const frac = (units % UNITS_PER_MBITE).toString().padStart(MBITE_DECIMALS, "0");
  return `${whole}.${frac}`.replace(/\.?0+$/, (m) => (m.includes(".") ? "" : m));
}

/** Platform fee in units from an amount and basis points (300 = 3%). */
export function feeFromBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / 10_000n;
}

/** Is `received` within [amount*(1-tol), ∞)? Returns under/ok/over. */
export function classifyPayment(
  amount: bigint,
  received: bigint,
  tolerance: number,
): "under" | "ok" | "over" {
  const floor = amount - (amount * BigInt(Math.round(tolerance * 10_000))) / 10_000n;
  const ceil = amount + (amount * BigInt(Math.round(tolerance * 10_000))) / 10_000n;
  if (received < floor) return "under";
  if (received > ceil) return "over";
  return "ok";
}
