import { createHmac } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";

/**
 * Webhook delivery (Workstream B §2). On fulfilling a WEBHOOK product we POST a
 * JSON summary to the merchant's endpoint, signed with an HMAC the merchant can
 * verify. Retries a few times with short backoff; requires a 2xx. Deliberately
 * inline — it does NOT depend on the BullMQ queue.
 */

/** Canonical HMAC-SHA256 (hex) of a webhook body. Exported for unit testing. */
export function webhookSignature(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export interface WebhookResult {
  delivered: boolean;
  status: number | null;
  attempts: number;
  url: string;
  error?: string;
}

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 200;
const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class WebhookService {
  private readonly log = new Logger(WebhookService.name);

  private async sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  /**
   * POST `payload` (JSON) to `url`, signing the exact serialized body with
   * `secret` via the `X-MoonBite-Signature` header. Resolves with the outcome;
   * never throws for transport/HTTP errors (the caller decides what to do).
   */
  async deliver(
    url: string,
    secret: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookResult> {
    const body = JSON.stringify(payload);
    const signature = webhookSignature(secret, body);
    let lastStatus: number | null = null;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-moonbite-signature": signature,
            },
            body,
            signal: ac.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        lastStatus = res.status;
        if (res.ok) {
          return { delivered: true, status: res.status, attempts: attempt, url };
        }
        lastError = `HTTP ${res.status}`;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }

      if (attempt < MAX_ATTEMPTS) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
      }
    }

    this.log.warn(`Webhook delivery to ${url} failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
    return { delivered: false, status: lastStatus, attempts: MAX_ATTEMPTS, url, error: lastError };
  }
}
