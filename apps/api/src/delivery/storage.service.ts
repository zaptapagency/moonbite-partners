import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Signed-download primitives (Workstream B §1). We mint short-lived capability
 * URLs for a storage object WITHOUT a cloud SDK — a plain HMAC over
 * orderId+objectKey+exp. The buyer presents the URL to {@link DownloadController},
 * which re-derives the HMAC and 302-redirects to the real object.
 *
 * The signing/verifying core is a pair of pure functions so they can be unit
 * tested without Nest DI (see storage.service.spec.ts).
 */

/** What the download HMAC covers. */
export interface DownloadClaims {
  orderId: string;
  objectKey: string;
  /** Unix seconds after which the signature is no longer honored. */
  exp: number;
}

/**
 * Deterministic HMAC-SHA256 (hex) over the download claims. Newline-delimited
 * so the fields cannot be ambiguously concatenated.
 */
export function signDownload(secret: string, claims: DownloadClaims): string {
  return createHmac("sha256", secret)
    .update(`${claims.orderId}\n${claims.objectKey}\n${claims.exp}`)
    .digest("hex");
}

/** Constant-time comparison of two hex signatures (never leaks via timing). */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** True when the provided signature matches the one we would mint. */
export function verifyDownload(
  secret: string,
  claims: DownloadClaims,
  sig: string,
): boolean {
  return safeEqualHex(signDownload(secret, claims), sig);
}

@Injectable()
export class StorageService {
  private readonly secret: string;
  private readonly publicBaseUrl: string;
  private readonly storageBaseUrl: string;
  private readonly ttlSeconds: number;

  constructor(config: ConfigService) {
    this.secret = config.get<string>("DOWNLOAD_URL_SECRET") ?? "";
    this.publicBaseUrl = (config.get<string>("PUBLIC_BASE_URL") ?? "").replace(/\/+$/, "");
    this.storageBaseUrl = (config.get<string>("STORAGE_BASE_URL") ?? "").replace(/\/+$/, "");
    this.ttlSeconds = Number(config.get("SIGNED_URL_TTL_SECONDS") ?? 300);
  }

  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  /** Build a short-lived signed URL the buyer can follow to the object. */
  buildSignedUrl(orderId: string, objectKey: string, ttlSeconds?: number): string {
    const exp = this.now() + (ttlSeconds ?? this.ttlSeconds);
    const sig = signDownload(this.secret, { orderId, objectKey, exp });
    const qs = new URLSearchParams({ exp: String(exp), sig });
    return `${this.publicBaseUrl}/download/${orderId}?${qs.toString()}`;
  }

  /** Validate a presented signature against the claims. */
  verify(orderId: string, objectKey: string, exp: number, sig: string): boolean {
    if (!this.secret) return false;
    return verifyDownload(this.secret, { orderId, objectKey, exp }, sig);
  }

  /** True when `exp` (unix seconds) is in the past. */
  isExpired(exp: number): boolean {
    return !Number.isFinite(exp) || exp < this.now();
  }

  /** The real, SDK-free object URL we redirect to once a signature checks out. */
  objectUrl(objectKey: string): string {
    return `${this.storageBaseUrl}/${objectKey.replace(/^\/+/, "")}`;
  }
}
