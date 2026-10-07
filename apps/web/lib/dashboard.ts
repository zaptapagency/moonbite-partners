"use client";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const TOKEN_KEY = "mb_token";

// --- token storage (per-viewer convenience; wrapped for private-mode safety) ---
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(t: string) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
}
export function clearToken() {
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
    const token = getToken();
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
export interface AuthResult {
  accessToken: string;
  merchant: { id: string; email: string; displayName: string };
}

export async function register(email: string, password: string, displayName: string) {
  const r = await req<AuthResult>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
  setToken(r.accessToken);
  return r;
}

export async function login(email: string, password: string) {
  const r = await req<AuthResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(r.accessToken);
  return r;
}

// --- dashboard data ---
export interface Profile {
  id: string;
  email: string;
  displayName: string;
  tier: string;
  feeBps: number;
  xpubConfigured: boolean;
  createdAt: string;
}
export interface DashProduct {
  id: string;
  title: string;
  priceMbite: string;
  deliveryMethod: string;
  active: boolean;
  _count: { orders: number; licenseKeys: number };
}
export interface DashOrder {
  id: string;
  status: string;
  amountMbite: string;
  receivedMbite: string;
  confirmations: number;
  requiredConfirmations: number;
  product: { title: string };
  refund: { id: string; status: string } | null;
  createdAt: string;
}
export interface DashRefund {
  id: string;
  status: string;
  refundAddress: string;
  amountMbite: string;
  txid: string | null;
  confirmations: number;
  order: { id: string; product: { title: string } };
}

export const getProfile = () => req<Profile>("/merchants/me", {}, true);
export const getMyProducts = () => req<DashProduct[]>("/merchants/me/products", {}, true);
export const getMyOrders = () => req<DashOrder[]>("/merchants/me/orders", {}, true);
export const getMyRefunds = () => req<DashRefund[]>("/merchants/me/refunds", {}, true);

export const setXpub = (xpub: string) =>
  req("/merchants/me/xpub", { method: "PUT", body: JSON.stringify({ xpub }) }, true);

export const createProduct = (p: {
  title: string;
  description?: string;
  priceMbiteUnits: number;
  deliveryMethod: string;
}) => req("/products", { method: "POST", body: JSON.stringify(p) }, true);

export const submitRefund = (id: string, txid: string) =>
  req(`/refunds/${id}/submit`, { method: "POST", body: JSON.stringify({ txid }) }, true);

export const rejectRefund = (id: string, reason?: string) =>
  req(`/refunds/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }, true);
