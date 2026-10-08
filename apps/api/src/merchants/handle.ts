/**
 * Public storefront handle rules (Gumroad-style /@handle).
 * 3–30 chars, lowercase letters, digits and hyphens only.
 */
export const HANDLE_PATTERN = /^[a-z0-9-]{3,30}$/;

/** True when `handle` is a syntactically valid storefront handle. */
export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}
