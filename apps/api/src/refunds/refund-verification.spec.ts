import { RefundTxView, verifyRefund } from "./refund-verification";

const ADDR = "mbite1qbuyerreturnaddressxxxxxxxxxxxxxxxxxx";
const OTHER = "mbite1qsomeotheraddressxxxxxxxxxxxxxxxxxxxx";
const AMOUNT = 100_000_000n; // 1 MBITE

function tx(overrides: Partial<RefundTxView> = {}): RefundTxView {
  return {
    confirmations: 2,
    outputs: [{ address: ADDR, valueUnits: AMOUNT }],
    ...overrides,
  };
}

describe("verifyRefund", () => {
  it("CONFIRMED when the return address is paid in full with enough confirmations", () => {
    expect(verifyRefund(tx(), ADDR, AMOUNT, 2, 0.02)).toBe("CONFIRMED");
  });

  it("WRONG_ADDRESS when no output pays the return address", () => {
    const t = tx({ outputs: [{ address: OTHER, valueUnits: AMOUNT }] });
    expect(verifyRefund(t, ADDR, AMOUNT, 2, 0.02)).toBe("WRONG_ADDRESS");
  });

  it("UNDERPAID_REFUND when the return address is paid too little", () => {
    const t = tx({ outputs: [{ address: ADDR, valueUnits: 50_000_000n }] });
    expect(verifyRefund(t, ADDR, AMOUNT, 2, 0.02)).toBe("UNDERPAID_REFUND");
  });

  it("PENDING_CONFIRMATIONS when amount is right but tx is not deep enough", () => {
    const t = tx({ confirmations: 1 });
    expect(verifyRefund(t, ADDR, AMOUNT, 2, 0.02)).toBe("PENDING_CONFIRMATIONS");
  });

  it("sums multiple outputs that pay the return address (change splits)", () => {
    const t = tx({
      outputs: [
        { address: ADDR, valueUnits: 60_000_000n },
        { address: OTHER, valueUnits: 999n }, // merchant change, ignored
        { address: ADDR, valueUnits: 40_000_000n },
      ],
    });
    expect(verifyRefund(t, ADDR, AMOUNT, 2, 0.02)).toBe("CONFIRMED");
  });

  it("accepts an overpaid refund (merchant sent a bit extra)", () => {
    const t = tx({ outputs: [{ address: ADDR, valueUnits: 110_000_000n }] });
    expect(verifyRefund(t, ADDR, AMOUNT, 2, 0.02)).toBe("CONFIRMED");
  });

  it("ignores outputs with no decoded address", () => {
    const t = tx({
      outputs: [
        { valueUnits: 100_000_000n }, // OP_RETURN / undecodable
        { address: ADDR, valueUnits: AMOUNT },
      ],
    });
    expect(verifyRefund(t, ADDR, AMOUNT, 2, 0.02)).toBe("CONFIRMED");
  });

  it("checks confirmations only after the amount is satisfied", () => {
    // Underpaid AND shallow → the amount problem wins (actionable for the merchant).
    const t = tx({ confirmations: 0, outputs: [{ address: ADDR, valueUnits: 1n }] });
    expect(verifyRefund(t, ADDR, AMOUNT, 2, 0.02)).toBe("UNDERPAID_REFUND");
  });
});
