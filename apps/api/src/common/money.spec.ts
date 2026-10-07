import {
  classifyPayment,
  coinsToUnits,
  feeFromBps,
  unitsToCoins,
  UNITS_PER_MBITE,
} from "./money";

describe("coinsToUnits", () => {
  it("scales whole coins to smallest units", () => {
    expect(coinsToUnits(1)).toBe(100_000_000n);
    expect(coinsToUnits(5)).toBe(500_000_000n);
  });

  it("handles fractional coins without float drift", () => {
    expect(coinsToUnits(0.1)).toBe(10_000_000n);
    expect(coinsToUnits(1.23456789)).toBe(123_456_789n);
  });

  it("maps zero to zero", () => {
    expect(coinsToUnits(0)).toBe(0n);
  });
});

describe("unitsToCoins", () => {
  it("renders whole amounts with no decimal point", () => {
    expect(unitsToCoins(100_000_000n)).toBe("1");
    expect(unitsToCoins(500_000_000n)).toBe("5");
    expect(unitsToCoins(0n)).toBe("0");
  });

  it("trims trailing zeros from fractional amounts", () => {
    expect(unitsToCoins(150_000_000n)).toBe("1.5");
    expect(unitsToCoins(120_300_000n)).toBe("1.203");
  });

  it("keeps full precision for tiny amounts", () => {
    expect(unitsToCoins(1n)).toBe("0.00000001");
  });

  it("round-trips with coinsToUnits", () => {
    expect(unitsToCoins(coinsToUnits(1.5))).toBe("1.5");
  });

  it("exposes the expected scale factor", () => {
    expect(UNITS_PER_MBITE).toBe(100_000_000n);
  });
});

describe("feeFromBps", () => {
  it("computes a 3% platform fee", () => {
    expect(feeFromBps(100_000_000n, 300)).toBe(3_000_000n);
  });

  it("is zero at zero bps", () => {
    expect(feeFromBps(100_000_000n, 0)).toBe(0n);
  });

  it("floors sub-unit fees (integer division)", () => {
    expect(feeFromBps(1n, 300)).toBe(0n);
  });
});

describe("classifyPayment", () => {
  const amount = 100_000_000n; // floor 98_000_000, ceil 102_000_000 at 2%
  const tol = 0.02;

  it("flags payments below the floor as under", () => {
    expect(classifyPayment(amount, 97_999_999n, tol)).toBe("under");
  });

  it("accepts the exact amount as ok", () => {
    expect(classifyPayment(amount, amount, tol)).toBe("ok");
  });

  it("treats the floor and ceil as inclusive ok", () => {
    expect(classifyPayment(amount, 98_000_000n, tol)).toBe("ok");
    expect(classifyPayment(amount, 102_000_000n, tol)).toBe("ok");
  });

  it("flags payments above the ceil as over", () => {
    expect(classifyPayment(amount, 102_000_001n, tol)).toBe("over");
  });

  it("with zero tolerance, only the exact amount is ok", () => {
    expect(classifyPayment(amount, amount, 0)).toBe("ok");
    expect(classifyPayment(amount, amount - 1n, 0)).toBe("under");
    expect(classifyPayment(amount, amount + 1n, 0)).toBe("over");
  });
});
