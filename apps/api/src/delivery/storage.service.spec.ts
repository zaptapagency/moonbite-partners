import { signDownload, verifyDownload, safeEqualHex } from "./storage.service";

const SECRET = "test-download-secret";
const claims = { orderId: "order_abc", objectKey: "deliverables/book.pdf", exp: 1_900_000_000 };

describe("signDownload", () => {
  it("is deterministic for the same secret + claims", () => {
    expect(signDownload(SECRET, claims)).toBe(signDownload(SECRET, claims));
  });

  it("produces a 64-char hex SHA-256 digest", () => {
    expect(signDownload(SECRET, claims)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the secret changes", () => {
    expect(signDownload("other-secret", claims)).not.toBe(signDownload(SECRET, claims));
  });

  it("changes when any claim changes", () => {
    const base = signDownload(SECRET, claims);
    expect(signDownload(SECRET, { ...claims, orderId: "order_xyz" })).not.toBe(base);
    expect(signDownload(SECRET, { ...claims, objectKey: "deliverables/other.pdf" })).not.toBe(base);
    expect(signDownload(SECRET, { ...claims, exp: claims.exp + 1 })).not.toBe(base);
  });

  it("is not forgeable by swapping field boundaries (newline-delimited)", () => {
    // "a\nb" must not collide with "a"+"\nb" moved across the field split.
    const a = signDownload(SECRET, { orderId: "a", objectKey: "b", exp: 1 });
    const b = signDownload(SECRET, { orderId: "a\nb", objectKey: "", exp: 1 });
    expect(a).not.toBe(b);
  });
});

describe("verifyDownload", () => {
  it("accepts a signature it just minted", () => {
    const sig = signDownload(SECRET, claims);
    expect(verifyDownload(SECRET, claims, sig)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const sig = signDownload(SECRET, claims);
    const tampered = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    expect(verifyDownload(SECRET, claims, tampered)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const sig = signDownload("attacker-secret", claims);
    expect(verifyDownload(SECRET, claims, sig)).toBe(false);
  });

  it("rejects a signature bound to different claims", () => {
    const sig = signDownload(SECRET, claims);
    expect(verifyDownload(SECRET, { ...claims, exp: claims.exp + 1 }, sig)).toBe(false);
  });

  it("rejects garbage / empty input without throwing", () => {
    expect(verifyDownload(SECRET, claims, "")).toBe(false);
    expect(verifyDownload(SECRET, claims, "not-hex")).toBe(false);
  });
});

describe("safeEqualHex", () => {
  it("is true only for identical hex strings", () => {
    expect(safeEqualHex("abcd", "abcd")).toBe(true);
    expect(safeEqualHex("abcd", "abce")).toBe(false);
  });

  it("is false for different lengths or empty input", () => {
    expect(safeEqualHex("ab", "abcd")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
});
