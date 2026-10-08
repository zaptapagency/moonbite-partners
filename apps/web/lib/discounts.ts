"use client";

import { getToken } from "./dashboard";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** A discount code as returned by the API. BigInt fields arrive as strings. */
export interface Discount {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffMbite: string | null;
  productId: string | null;
  product: { id: string; title: string } | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

/** Fields the create form submits. Exactly one of percentOff / amountOffUnits. */
export interface CreateDiscountInput {
  code: string;
  percentOff?: number;
  amountOffUnits?: number;
  productId?: string;
  maxRedemptions?: number;
  expiresAt?: string;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  // DELETE/204-style responses may have no body.
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

export const listDiscounts = () => req<Discount[]>("/discounts");

export const createDiscount = (input: CreateDiscountInput) =>
  req<Discount>("/discounts", { method: "POST", body: JSON.stringify(input) });

export const deactivateDiscount = (id: string) =>
  req<Discount>(`/discounts/${id}`, { method: "DELETE" });
