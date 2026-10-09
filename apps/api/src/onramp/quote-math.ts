import { UNITS_PER_MBITE } from "../common/money";

export interface FiatQuote {
  /** Base MBITE being purchased, smallest unit. */
  mbiteAmount: bigint;
  /** MBITE per 1 USD, as resolved by the oracle. */
  mbitePerUsd: number;
  /** Applied spread in basis points. */
  spreadBps: number;
  /** Buyer-facing fiat charge (includes spread), rounded to cents. */
  fiatAmount: number;
}

/**
 * Pure fiat-quote math (ONRAMP.md §3). Converts the MBITE amount to USD at the
 * oracle rate, then adds the platform spread (margin + price-risk buffer). No
 * I/O — the oracle rate is passed in. Throws on a non-positive rate.
 *
 *   usdPerMbite = 1 / mbitePerUsd
 *   baseUsd     = mbiteCoins * usdPerMbite
 *   fiat        = baseUsd * (1 + spreadBps/10000)
 */
export function computeFiatQuote(
  mbiteAmount: bigint,
  mbitePerUsd: number,
  spreadBps: number,
): FiatQuote {
  if (!(mbitePerUsd > 0)) throw new Error("mbitePerUsd must be > 0");
  if (mbiteAmount <= 0n) throw new Error("mbiteAmount must be > 0");

  const mbiteCoins = Number(mbiteAmount) / Number(UNITS_PER_MBITE);
  const baseUsd = mbiteCoins / mbitePerUsd;
  const withSpread = baseUsd * (1 + spreadBps / 10_000);
  const fiatAmount = Math.round(withSpread * 100) / 100; // cents

  return { mbiteAmount, mbitePerUsd, spreadBps, fiatAmount };
}
