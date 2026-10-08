"use client";

import { getToken } from "./dashboard";
import type { RatingAggregate } from "./api";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** A product as returned on a public storefront (includes the cover image). */
export interface StorefrontProduct {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  priceMbite: string; // BigInt serialized as a string by the API
  priceCurrency?: string;
  displayUsd?: string | null;
  rating: RatingAggregate;
}

/** Public creator profile shown at the top of a storefront. */
export interface StorefrontMerchant {
  id: string;
  displayName: string;
  handle: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

export interface Storefront {
  merchant: StorefrontMerchant;
  products: StorefrontProduct[];
}

/** Fetch a public storefront by handle; null when the handle does not exist. */
export async function getStorefront(handle: string): Promise<Storefront | null> {
  const res = await fetch(`${BASE}/storefront/${encodeURIComponent(handle)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load storefront");
  return res.json();
}

/** The merchant's own editable profile (dashboard). */
export interface MyProfile {
  id: string;
  email: string;
  displayName: string;
  handle: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
  };
  const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message;
  return msg || `Request failed (${res.status})`;
}

/** Load the authenticated merchant's profile (reuses the dashboard token). */
export async function getMyProfile(): Promise<MyProfile> {
  const token = getToken();
  const res = await fetch(`${BASE}/merchants/me`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

/** Save the storefront profile (handle/bio/avatarUrl) via the new endpoint. */
export async function updateMyProfile(input: {
  handle?: string;
  bio?: string;
  avatarUrl?: string;
}): Promise<MyProfile> {
  const token = getToken();
  const res = await fetch(`${BASE}/merchants/me/profile`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}
