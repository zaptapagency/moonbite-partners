import { createHmac } from "node:crypto";
import { webhookSignature } from "./webhook.service";

const SECRET = "whsec_test_merchant_secret";

describe("webhookSignature", () => {
  it("matches a hand-computed HMAC-SHA256 hex of the exact body", () => {
    const body = JSON.stringify({ event: "order.fulfilled", orderId: "order_1" });
    const expected = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(webhookSignature(SECRET, body)).toBe(expected);
  });

  it("is deterministic", () => {
    const body = '{"a":1}';
    expect(webhookSignature(SECRET, body)).toBe(webhookSignature(SECRET, body));
  });

  it("produces a 64-char hex digest", () => {
    expect(webhookSignature(SECRET, "{}")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when the body differs (even by one byte)", () => {
    expect(webhookSignature(SECRET, '{"a":1}')).not.toBe(webhookSignature(SECRET, '{"a":2}'));
  });

  it("differs when the secret differs", () => {
    const body = '{"a":1}';
    expect(webhookSignature("other", body)).not.toBe(webhookSignature(SECRET, body));
  });

  it("round-trips: a receiver recomputes the same signature", () => {
    const body = JSON.stringify({ orderId: "order_42", amountMbite: "100000000" });
    const sent = webhookSignature(SECRET, body);
    const recomputedByReceiver = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(recomputedByReceiver).toBe(sent);
  });
});
