"use client";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
// DISTINCT from the merchant token key ("mb_token") so the two sessions never collide.
const TOKEN_KEY = "mb_buyer_token";

// --- token storage (per-viewer convenience; wrapped for private-mode safety) ---
export function getBuyerToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setBuyerToken(t: string) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
}
export function clearBuyerToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function req<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (auth) {
    const token = getBuyerToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// --- auth ---
export interface BuyerAuthResult {
  accessToken: string;
  buyer: { id: string; email: string };
}

export async function registerBuyer(email: string, password: string) {
  const r = await req<BuyerAuthResult>("/buyer/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setBuyerToken(r.accessToken);
  return r;
}

export async function loginBuyer(email: string, password: string) {
  const r = await req<BuyerAuthResult>("/buyer/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setBuyerToken(r.accessToken);
  return r;
}

export const getBuyerMe = () =>
  req<{ id: string; email: string; createdAt: string }>("/buyer/me", {}, true);

// --- purchase library ---
export interface LibraryEntitlement {
  key?: string;
  downloadUrl?: string;
  objectKey?: string;
  access?: string;
  courseRef?: string;
  webhook?: { delivered: boolean; status?: number; attempts?: number; deliveredAt?: string };
  [k: string]: unknown;
}

export interface LibraryItem {
  orderId: string;
  status: string;
  productTitle: string;
  deliveryMethod: string;
  deliverySummary: string;
  createdAt: string;
  entitlement?: LibraryEntitlement;
}

export const getLibrary = () => req<LibraryItem[]>("/buyer/library", {}, true);
