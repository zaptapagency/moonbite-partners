import { OrderStatus, TERMINAL_STATUSES, isTerminal } from "@moonbite/shared";

describe("OrderStatus terminal set", () => {
  it("marks exactly the four end states as terminal", () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(
      [
        OrderStatus.CANCELLED,
        OrderStatus.EXPIRED,
        OrderStatus.FULFILLED,
        OrderStatus.REFUNDED,
      ].sort(),
    );
  });

  it("isTerminal is true for every terminal state", () => {
    for (const s of TERMINAL_STATUSES) expect(isTerminal(s)).toBe(true);
  });

  it("isTerminal is false for in-flight states", () => {
    const inFlight = [
      OrderStatus.AWAITING_PAYMENT,
      OrderStatus.DETECTED,
      OrderStatus.UNDERPAID,
      OrderStatus.OVERPAID,
      OrderStatus.PAID,
    ];
    for (const s of inFlight) expect(isTerminal(s)).toBe(false);
  });
});
