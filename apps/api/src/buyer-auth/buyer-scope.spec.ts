import { BUYER_SCOPE, isBuyerToken } from "./buyer-scope";

describe("isBuyerToken (buyer scope check)", () => {
  it("accepts a well-formed buyer-scoped payload", () => {
    expect(isBuyerToken({ sub: "b1", email: "a@b.co", scope: BUYER_SCOPE })).toBe(true);
  });

  it("rejects a merchant token (no scope claim)", () => {
    expect(isBuyerToken({ sub: "m1", email: "a@b.co" })).toBe(false);
  });

  it("rejects a token with the wrong scope", () => {
    expect(isBuyerToken({ sub: "m1", email: "a@b.co", scope: "merchant" })).toBe(false);
  });

  it("rejects payloads missing sub/email", () => {
    expect(isBuyerToken({ scope: BUYER_SCOPE })).toBe(false);
    expect(isBuyerToken({ sub: "", email: "a@b.co", scope: BUYER_SCOPE })).toBe(false);
    expect(isBuyerToken({ sub: "b1", scope: BUYER_SCOPE })).toBe(false);
  });

  it("rejects non-object inputs", () => {
    expect(isBuyerToken(null)).toBe(false);
    expect(isBuyerToken(undefined)).toBe(false);
    expect(isBuyerToken("buyer")).toBe(false);
  });
});
