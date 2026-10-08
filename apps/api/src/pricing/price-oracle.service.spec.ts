import { ConfigService } from "@nestjs/config";
import {
  PriceOracleService,
  convertUsdToMbiteUnits,
  DEV_FALLBACK_MBITE_PER_USD,
} from "./price-oracle.service";

function cfg(map: Record<string, unknown>): ConfigService {
  return { get: (k: string) => map[k] } as unknown as ConfigService;
}

describe("convertUsdToMbiteUnits (pure math)", () => {
  it("multiplies USD by the rate into smallest MBITE units", () => {
    // 100 USD * 0.01 MBITE/USD = 1 MBITE = 100_000_000 units
    expect(convertUsdToMbiteUnits(100, 0.01)).toBe(100_000_000n);
  });

  it("handles fractional USD and rates without float drift", () => {
    // 19.99 USD * 0.5 MBITE/USD = 9.995 MBITE
    expect(convertUsdToMbiteUnits(19.99, 0.5)).toBe(999_500_000n);
  });

  it("maps zero USD to zero units", () => {
    expect(convertUsdToMbiteUnits(0, 0.01)).toBe(0n);
  });
});

describe("PriceOracleService fallback behavior", () => {
  it("uses the configured fixed rate when no oracle URL is set", async () => {
    const svc = new PriceOracleService(cfg({ MBITE_USD_RATE: 0.02 }));
    expect(await svc.getMbitePerUsd()).toBe(0.02);
    // 100 USD * 0.02 = 2 MBITE = 200_000_000 units
    expect(svc.usdToMbiteUnits(100)).toBe(200_000_000n);
  });

  it("falls back to the clearly-labeled dev rate when nothing is configured", async () => {
    const svc = new PriceOracleService(cfg({}));
    expect(await svc.getMbitePerUsd()).toBe(DEV_FALLBACK_MBITE_PER_USD);
  });

  it("never throws into checkout — falls back when the oracle fetch fails", async () => {
    const spy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    const svc = new PriceOracleService(
      cfg({ PRICE_ORACLE_URL: "https://oracle.test/rate", MBITE_USD_RATE: 0.05 }),
    );
    await expect(svc.getMbitePerUsd()).resolves.toBe(0.05);
    spy.mockRestore();
  });

  it("falls back when the oracle returns a non-positive / invalid rate", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rate: 0 }),
    } as Response);
    const svc = new PriceOracleService(
      cfg({ PRICE_ORACLE_URL: "https://oracle.test/rate", MBITE_USD_RATE: 0.03 }),
    );
    await expect(svc.getMbitePerUsd()).resolves.toBe(0.03);
    spy.mockRestore();
  });

  it("reads the rate from the oracle at the configured JSON path", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { mbitePerUsd: 0.25 } }),
    } as Response);
    const svc = new PriceOracleService(
      cfg({
        PRICE_ORACLE_URL: "https://oracle.test/rate",
        PRICE_ORACLE_RATE_PATH: "data.mbitePerUsd",
      }),
    );
    expect(await svc.getMbitePerUsd()).toBe(0.25);
    spy.mockRestore();
  });
});
