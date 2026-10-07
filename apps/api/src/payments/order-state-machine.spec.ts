import { OrderStatus } from "@moonbite/shared";
import { decideNextStatus, ReconcileInput } from "./order-state-machine";

/** 1 MBITE in smallest units. */
const AMOUNT = 100_000_000n;

/** Baseline: awaiting payment, nothing seen, quote still valid, 2 confs required, 2% tol. */
function input(overrides: Partial<ReconcileInput> = {}): ReconcileInput {
  return {
    current: OrderStatus.AWAITING_PAYMENT,
    quoteExpired: false,
    amountUnits: AMOUNT,
    receivedUnits: 0n,
    confirmations: 0,
    requiredConfirmations: 2,
    tolerance: 0.02,
    ...overrides,
  };
}

describe("decideNextStatus — terminal states are frozen", () => {
  const terminals = [
    OrderStatus.FULFILLED,
    OrderStatus.EXPIRED,
    OrderStatus.REFUNDED,
    OrderStatus.CANCELLED,
  ];
  it.each(terminals)("%s never transitions, even with a full confirmed payment", (s) => {
    const next = decideNextStatus(
      input({ current: s, receivedUnits: AMOUNT, confirmations: 10 }),
    );
    expect(next).toBe(s);
  });
});

describe("decideNextStatus — awaiting / expiry", () => {
  it("stays AWAITING_PAYMENT when no funds and quote still valid", () => {
    expect(decideNextStatus(input())).toBe(OrderStatus.AWAITING_PAYMENT);
  });

  it("expires when no funds and the quote window has elapsed", () => {
    expect(decideNextStatus(input({ quoteExpired: true }))).toBe(OrderStatus.EXPIRED);
  });

  it("does NOT expire a DETECTED order just because the quote lapsed", () => {
    // Already saw 0-conf money; quote expiry shouldn't kill it.
    const next = decideNextStatus(
      input({ current: OrderStatus.DETECTED, quoteExpired: true, receivedUnits: 0n }),
    );
    expect(next).toBe(OrderStatus.DETECTED);
  });

  it("honors a payment that arrived even after the quote expired", () => {
    const next = decideNextStatus(
      input({ quoteExpired: true, receivedUnits: AMOUNT, confirmations: 2 }),
    );
    expect(next).toBe(OrderStatus.PAID);
  });
});

describe("decideNextStatus — confirmations gate", () => {
  it("DETECTED when exact amount but not enough confirmations", () => {
    expect(decideNextStatus(input({ receivedUnits: AMOUNT, confirmations: 1 }))).toBe(
      OrderStatus.DETECTED,
    );
  });

  it("PAID when confirmations exactly meet the requirement", () => {
    expect(decideNextStatus(input({ receivedUnits: AMOUNT, confirmations: 2 }))).toBe(
      OrderStatus.PAID,
    );
  });

  it("PAID when confirmations exceed the requirement", () => {
    expect(decideNextStatus(input({ receivedUnits: AMOUNT, confirmations: 99 }))).toBe(
      OrderStatus.PAID,
    );
  });

  it("instant PAID when zero confirmations are required (0-conf delivery)", () => {
    const next = decideNextStatus(
      input({ receivedUnits: AMOUNT, confirmations: 0, requiredConfirmations: 0 }),
    );
    expect(next).toBe(OrderStatus.PAID);
  });
});

describe("decideNextStatus — amount tolerance bands (2%)", () => {
  // floor = 98_000_000, ceil = 102_000_000
  it("UNDERPAID just below the tolerance floor, regardless of confirmations", () => {
    const next = decideNextStatus(
      input({ receivedUnits: 97_999_999n, confirmations: 10 }),
    );
    expect(next).toBe(OrderStatus.UNDERPAID);
  });

  it("accepts a payment exactly at the tolerance floor (→ PAID when confirmed)", () => {
    const next = decideNextStatus(
      input({ receivedUnits: 98_000_000n, confirmations: 2 }),
    );
    expect(next).toBe(OrderStatus.PAID);
  });

  it("treats overpayment within/above ceil as payable (→ PAID when confirmed)", () => {
    const next = decideNextStatus(
      input({ receivedUnits: 102_000_001n, confirmations: 2 }),
    );
    expect(next).toBe(OrderStatus.PAID);
  });

  it("overpayment that is not yet confirmed is DETECTED", () => {
    const next = decideNextStatus(
      input({ receivedUnits: 200_000_000n, confirmations: 0 }),
    );
    expect(next).toBe(OrderStatus.DETECTED);
  });
});

describe("decideNextStatus — recovery / forward progress", () => {
  it("UNDERPAID recovers to PAID after a confirmed top-up", () => {
    const next = decideNextStatus(
      input({ current: OrderStatus.UNDERPAID, receivedUnits: AMOUNT, confirmations: 3 }),
    );
    expect(next).toBe(OrderStatus.PAID);
  });

  it("a confirmed payment seen while still AWAITING jumps straight to PAID", () => {
    const next = decideNextStatus(
      input({ current: OrderStatus.AWAITING_PAYMENT, receivedUnits: AMOUNT, confirmations: 5 }),
    );
    expect(next).toBe(OrderStatus.PAID);
  });
});
