/**
 * Buyer tokens carry a `scope: "buyer"` claim so they can never be mistaken
 * for a merchant token (which has no scope). Keep this a pure, dependency-free
 * helper so both the guard and the unit test can share it.
 */
export const BUYER_SCOPE = "buyer" as const;

export interface BuyerTokenPayload {
  sub: string;
  email: string;
  scope?: string;
}

/** True only when the decoded JWT payload is a buyer-scoped token. */
export function isBuyerToken(payload: unknown): payload is BuyerTokenPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    p.scope === BUYER_SCOPE &&
    typeof p.sub === "string" &&
    p.sub.length > 0 &&
    typeof p.email === "string"
  );
}
