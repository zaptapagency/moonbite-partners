import { isValidHandle } from "./handle";

describe("isValidHandle", () => {
  it("accepts lowercase alphanumeric + hyphen handles of 3..30 chars", () => {
    for (const h of ["abc", "moon-bite", "creator123", "a-b-c", "x".repeat(30)]) {
      expect(isValidHandle(h)).toBe(true);
    }
  });

  it("rejects handles that are too short or too long", () => {
    expect(isValidHandle("ab")).toBe(false);
    expect(isValidHandle("x".repeat(31))).toBe(false);
    expect(isValidHandle("")).toBe(false);
  });

  it("rejects uppercase, spaces and other punctuation", () => {
    for (const h of ["ABC", "Moon", "has space", "under_score", "dot.dot", "emoji😀", "slash/slash"]) {
      expect(isValidHandle(h)).toBe(false);
    }
  });
});
