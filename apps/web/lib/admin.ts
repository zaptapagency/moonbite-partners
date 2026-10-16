"use client";

// Admin/super-admin API client. Separate token namespace from merchant/buyer.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const TOKEN_KEY = "mb_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setAdminToken(t: string) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
}
export function clearAdminToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function req<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (auth) {
    const token = getAdminToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) clearAdminToken();
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────
export type AdminRole = "ADMIN" | "SUPER_ADMIN";
export interface AdminMe {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  lastLoginAt: string | null;
  createdAt: string;
}
export interface Metrics {
  timeseries: { date: string; orders: number; gmv: string }[];
  trends: { orders7d: number | null; ordersLast7: number; ordersPrev7: number };
  counts: {
    merchants: number;
    suspendedMerchants: number;
    buyers: number;
    products: number;
    activeProducts: number;
    orders: number;
  };
  ordersByStatus: Record<string, number>;
  gmv: {
    allTime: { mbite: string; fees: string; orders: number };
    last7d: { mbite: string; fees: string; orders: number };
  };
  topMerchants: {
    id: string;
    displayName: string;
    handle: string | null;
    suspended: boolean;
    gmvMbite: string;
    feeMbite: string;
    orders: number;
  }[];
  recentOrders: {
    id: string;
    status: string;
    amountMbite: string;
    createdAt: string;
    product: { title: string };
    merchant: { displayName: string };
  }[];
}
export interface AdminMerchant {
  id: string;
  email: string;
  displayName: string;
  handle: string | null;
  tier: string;
  feeBps: number;
  suspended: boolean;
  emailVerified: boolean;
  createdAt: string;
  _count: { products: number; orders: number };
}
export interface AdminBuyer {
  id: string;
  email: string;
  suspended: boolean;
  createdAt: string;
  _count: { orders: number };
}
export interface AdminProduct {
  id: string;
  title: string;
  category: string | null;
  priceMbite: string;
  active: boolean;
  takedownReason: string | null;
  imageUrl: string | null;
  createdAt: string;
  merchant: { id: string; displayName: string; suspended: boolean };
  _count: { orders: number; reviews: number };
}
export interface AdminOrder {
  id: string;
  status: string;
  amountMbite: string;
  receivedMbite: string;
  feeMbite: string;
  confirmations: number;
  requiredConfirmations: number;
  createdAt: string;
  product: { title: string };
  merchant: { id: string; displayName: string };
  refund: { id: string; status: string } | null;
}
export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  buyerRef: string | null;
  createdAt: string;
  product: { id: string; title: string };
}
export interface AdminStaff {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
export interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
  admin: { email: string; displayName: string } | null;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export async function adminLogin(email: string, password: string) {
  const r = await req<{ accessToken: string; admin: AdminMe }>(
    "/admin/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false,
  );
  setAdminToken(r.accessToken);
  return r;
}
export const adminMe = () => req<AdminMe>("/admin/auth/me");

// ── Dashboards / lists ───────────────────────────────────────────────────
export const getMetrics = () => req<Metrics>("/admin/metrics");
export const listMerchants = (q = "") => req<AdminMerchant[]>(`/admin/merchants${q ? `?q=${encodeURIComponent(q)}` : ""}`);
export const listBuyers = (q = "") => req<AdminBuyer[]>(`/admin/buyers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
export const listProducts = (q = "", status = "") =>
  req<AdminProduct[]>(`/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) })}`);
export const listOrders = (status = "", q = "") =>
  req<AdminOrder[]>(`/admin/orders?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) })}`);
export const listReviews = (q = "") => req<AdminReview[]>(`/admin/reviews${q ? `?q=${encodeURIComponent(q)}` : ""}`);

// ── Mutations ───────────────────────────────────────────────────────────
export const suspendMerchant = (id: string, reason?: string) =>
  req(`/admin/merchants/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) });
export const unsuspendMerchant = (id: string) => req(`/admin/merchants/${id}/unsuspend`, { method: "POST" });
export const setMerchantFee = (id: string, feeBps: number) =>
  req(`/admin/merchants/${id}/fee`, { method: "PUT", body: JSON.stringify({ feeBps }) });
export const setMerchantTier = (id: string, tier: string) =>
  req(`/admin/merchants/${id}/tier`, { method: "PUT", body: JSON.stringify({ tier }) });
export const suspendBuyer = (id: string) => req(`/admin/buyers/${id}/suspend`, { method: "POST" });
export const unsuspendBuyer = (id: string) => req(`/admin/buyers/${id}/unsuspend`, { method: "POST" });
export const takedownProduct = (id: string, reason?: string) =>
  req(`/admin/products/${id}/takedown`, { method: "POST", body: JSON.stringify({ reason }) });
export const restoreProduct = (id: string) => req(`/admin/products/${id}/restore`, { method: "POST" });
export const deleteReview = (id: string) => req(`/admin/reviews/${id}/delete`, { method: "POST" });

// ── Super-admin ───────────────────────────────────────────────────────────
export const listAdmins = () => req<AdminStaff[]>("/admin/super/admins");
export const createAdmin = (input: { email: string; displayName: string; password: string; role: AdminRole }) =>
  req<AdminStaff>("/admin/super/admins", { method: "POST", body: JSON.stringify(input) });
export const updateAdmin = (id: string, patch: { displayName?: string; role?: AdminRole; active?: boolean }) =>
  req<AdminStaff>(`/admin/super/admins/${id}`, { method: "PUT", body: JSON.stringify(patch) });
export const deleteAdmin = (id: string) => req(`/admin/super/admins/${id}`, { method: "DELETE" });
export const getSettings = () => req<Record<string, unknown>>("/admin/super/settings");
export const setSetting = (key: string, value: unknown) =>
  req("/admin/super/settings", { method: "PUT", body: JSON.stringify({ key, value }) });
export const listAudit = (action = "") => req<AuditEntry[]>(`/admin/super/audit${action ? `?action=${encodeURIComponent(action)}` : ""}`);

// ── Formatting ─────────────────────────────────────────────────────────────
/** Maps an order status to an admin badge class. */
export function statusBadge(s: string): string {
  const map: Record<string, string> = {
    FULFILLED: "badge-green", PAID: "badge-green", OVERPAID: "badge-blue",
    AWAITING_PAYMENT: "badge-amber", DETECTED: "badge-amber",
    UNDERPAID: "badge-red", EXPIRED: "badge-gray", CANCELLED: "badge-gray",
    REFUNDED: "badge-blue",
  };
  return map[s] ?? "badge-gray";
}

export function fmtMbite(units: string | number): string {
  try {
    const u = BigInt(units);
    const whole = u / 100_000_000n;
    const frac = (u % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return String(units);
  }
}
