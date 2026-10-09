import { computeFiatQuote } from "./quote-math";

const ONE_MBITE = 100_000_000n; // smallest units

describe("computeFiatQuote", () => {
  it("converts MBITE→USD at the oracle rate with spread", () => {
    // mbitePerUsd = 100 → 1 MBITE = $0.01; 500 MBITE = $5.00; +3% spread = $5.15
    const q = computeFiatQuote(ONE_MBITE * 500n, 100, 300);
    expect(q.fiatAmount).toBeCloseTo(5.15, 2);
    expect(q.spreadBps).toBe(300);
    expect(q.mbitePerUsd).toBe(100);
  });

  it("zero spread yields the raw USD value", () => {
    // mbitePerUsd = 2 → 1 MBITE = $0.50; 10 MBITE = $5.00
    const q = computeFiatQuote(ONE_MBITE * 10n, 2, 0);
    expect(q.fiatAmount).toBeCloseTo(5.0, 2);
  });

  it("rounds to cents", () => {
    // 1 MBITE at mbitePerUsd=3 → $0.3333…; +3% → 0.3433… → 0.34
    const q = computeFiatQuote(ONE_MBITE, 3, 300);
    expect(Number.isInteger(Math.round(q.fiatAmount * 100))).toBe(true);
    expect(q.fiatAmount).toBeCloseTo(0.34, 2);
  });

  it("scales the spread correctly (10% = 1000 bps)", () => {
    const q = computeFiatQuote(ONE_MBITE * 100n, 1, 1000); // 100 MBITE @ $1 each = $100 → +10% = $110
    expect(q.fiatAmount).toBeCloseTo(110.0, 2);
  });

  it("rejects a non-positive rate", () => {
    expect(() => computeFiatQuote(ONE_MBITE, 0, 300)).toThrow();
    expect(() => computeFiatQuote(ONE_MBITE, -1, 300)).toThrow();
  });

  it("rejects a non-positive amount", () => {
    expect(() => computeFiatQuote(0n, 100, 300)).toThrow();
  });
});
