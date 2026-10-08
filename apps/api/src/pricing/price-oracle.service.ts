import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { coinsToUnits } from "../common/money";

/**
 * Clearly-labeled DEV fallback rate: 1 USD = 0.01 MBITE.
 * This is NOT a real market rate — set MBITE_USD_RATE (or a live PRICE_ORACLE_URL)
 * before accepting real funds.
 */
export const DEV_FALLBACK_MBITE_PER_USD = 0.01;

/**
 * Pure conversion — USD amount × (MBITE per USD) → smallest MBITE units.
 * Kept standalone so the money math is trivially unit-testable.
 */
export function convertUsdToMbiteUnits(usd: number, mbitePerUsd: number): bigint {
  return coinsToUnits(usd * mbitePerUsd);
}

interface RateCache {
  rate: number;
  expiresAt: number;
}

/**
 * MBITE/USD price oracle (Phase 2 USD pricing).
 *
 * Source is pluggable via env:
 *   - PRICE_ORACLE_URL        — HTTP(S) endpoint returning JSON (optional).
 *   - PRICE_ORACLE_RATE_PATH  — dotted path to the rate inside that JSON.
 *   - MBITE_USD_RATE          — fixed fallback rate (defaults to the dev value).
 *   - PRICE_ORACLE_TTL_SECONDS / PRICE_ORACLE_TIMEOUT_MS — cache + fetch timeout.
 *
 * Dependency-free (uses the Node global fetch) and resilient: it NEVER throws
 * into checkout — any failure falls back to the fixed rate and logs a warning.
 */
@Injectable()
export class PriceOracleService {
  private readonly log = new Logger(PriceOracleService.name);
  private readonly url?: string;
  private readonly jsonPath: string;
  private readonly fallbackRate: number;
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private cache?: RateCache;

  constructor(config: ConfigService) {
    const url = config.get<string>("PRICE_ORACLE_URL");
    this.url = url && url.trim() !== "" ? url.trim() : undefined;
    this.jsonPath = (config.get<string>("PRICE_ORACLE_RATE_PATH") ?? "rate").trim() || "rate";
    const fb = Number(config.get("MBITE_USD_RATE"));
    this.fallbackRate = Number.isFinite(fb) && fb > 0 ? fb : DEV_FALLBACK_MBITE_PER_USD;
    this.ttlMs = Number(config.get("PRICE_ORACLE_TTL_SECONDS") ?? 60) * 1000;
    this.timeoutMs = Number(config.get("PRICE_ORACLE_TIMEOUT_MS") ?? 3000);
  }

  /**
   * Current MBITE-per-USD rate. Cached in-memory for TTL seconds. Never throws:
   * on any oracle failure it returns (and caches) the fixed fallback rate.
   */
  async getMbitePerUsd(): Promise<number> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache.rate;
    const rate = await this.resolveRate();
    this.cache = { rate, expiresAt: now + this.ttlMs };
    return rate;
  }

  /**
   * Convert a USD amount to smallest MBITE units using the most recently
   * resolved rate. Call getMbitePerUsd() first (at quote time) to refresh and
   * lock the rate; if no rate has been resolved yet this uses the fallback.
   */
  usdToMbiteUnits(usd: number): bigint {
    return convertUsdToMbiteUnits(usd, this.currentRate());
  }

  private currentRate(): number {
    return this.cache?.rate ?? this.fallbackRate;
  }

  private async resolveRate(): Promise<number> {
    if (!this.url) return this.fallbackRate;
    try {
      const rate = await this.fetchRate(this.url);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`oracle returned an invalid rate: ${rate}`);
      }
      return rate;
    } catch (e) {
      this.log.warn(
        `Price oracle ${this.url} unavailable; using fallback ${this.fallbackRate} MBITE/USD: ${String(e)}`,
      );
      return this.fallbackRate;
    }
  }

  private async fetchRate(url: string): Promise<number> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as unknown;
      const picked = pickPath(body, this.jsonPath);
      return typeof picked === "string" ? Number(picked) : (picked as number);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Resolve a dotted JSON path like "data.rates.mbitePerUsd" against a parsed body. */
function pickPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}
