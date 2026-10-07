import { Injectable, Logger } from "@nestjs/common";
import { DeliveryMethod, Order, Prisma, Product } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../delivery/storage.service";
import { WebhookService } from "../delivery/webhook.service";
import { MailService } from "../mail/mail.service";

/** Shape of a product's method-specific delivery config (Product.deliveryConfig JSON). */
interface DeliveryConfig {
  objectKey?: string;
  webhookUrl?: string;
  webhookSecret?: string;
}

/** Rough "looks like an email" check — good enough to decide whether to send. */
function looksLikeEmail(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Turns a PAID order into a delivered product (PLAN.md §6). Idempotent:
 * calling twice for the same order must not issue two keys. Delivery is the
 * last step of the happy path: PAID → FULFILLED.
 */
@Injectable()
export class DeliveryService {
  private readonly log = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly webhook: WebhookService,
    private readonly mail: MailService,
  ) {}

  async fulfill(order: Order & { product: Product }): Promise<void> {
    // Idempotency guard — never double-deliver.
    const existing = await this.prisma.entitlement.findUnique({
      where: { orderId: order.id },
    });
    if (existing) return;

    const payload = await this.buildPayload(order);

    await this.prisma.$transaction([
      this.prisma.entitlement.create({
        data: { orderId: order.id, payload: payload as Prisma.InputJsonObject },
      }),
      this.prisma.order.update({
        where: { id: order.id },
        data: { status: "FULFILLED", fulfilledAt: new Date() },
      }),
    ]);

    this.log.log(`Fulfilled order ${order.id} via ${order.product.deliveryMethod}`);

    // Receipt is best-effort and must never roll back a completed delivery.
    await this.sendReceipt(order, payload);
  }

  private config(order: Order & { product: Product }): DeliveryConfig {
    return (order.product.deliveryConfig ?? {}) as DeliveryConfig;
  }

  private async buildPayload(
    order: Order & { product: Product },
  ): Promise<Record<string, unknown>> {
    switch (order.product.deliveryMethod) {
      case DeliveryMethod.LICENSE_KEY:
        return { key: await this.claimLicenseKey(order.productId, order.id) };

      case DeliveryMethod.SIGNED_DOWNLOAD: {
        const { objectKey } = this.config(order);
        if (!objectKey) {
          throw new Error(`Product ${order.productId} has no deliveryConfig.objectKey`);
        }
        // Store the objectKey so the entitlement endpoint can re-mint a fresh,
        // short-lived URL on demand; include one now for the receipt email.
        return {
          objectKey,
          downloadUrl: this.storage.buildSignedUrl(order.id, objectKey),
        };
      }

      case DeliveryMethod.WEBHOOK: {
        const { webhookUrl, webhookSecret } = this.config(order);
        if (!webhookUrl || !webhookSecret) {
          throw new Error(
            `Product ${order.productId} is missing deliveryConfig.webhookUrl/webhookSecret`,
          );
        }
        const result = await this.webhook.deliver(webhookUrl, webhookSecret, {
          event: "order.fulfilled",
          orderId: order.id,
          productId: order.productId,
          merchantId: order.merchantId,
          amountMbite: order.amountMbite.toString(),
          buyerRef: order.buyerRef ?? null,
          at: new Date().toISOString(),
        });
        // Require a 2xx: if the merchant never acknowledged, stay PAID and let
        // the reconciler retry (no entitlement is written on throw).
        if (!result.delivered) {
          throw new Error(
            `Webhook delivery failed (status=${result.status ?? "none"}, attempts=${result.attempts})`,
          );
        }
        return {
          webhook: {
            delivered: true,
            status: result.status,
            attempts: result.attempts,
            deliveredAt: new Date().toISOString(),
          },
        };
      }

      case DeliveryMethod.COURSE_ACCESS:
        return { access: "granted", courseRef: order.productId };

      default:
        return {};
    }
  }

  /** Send the buyer a receipt if we have an email in buyerRef. Never throws. */
  private async sendReceipt(
    order: Order & { product: Product },
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!looksLikeEmail(order.buyerRef)) return;
    try {
      await this.mail.sendReceipt({
        to: order.buyerRef,
        productTitle: order.product.title,
        orderId: order.id,
        accessNote: this.accessNote(order.product.deliveryMethod, payload),
      });
    } catch (e) {
      this.log.error(`Receipt dispatch failed for ${order.id}: ${String(e)}`);
    }
  }

  /** Human-readable access instructions derived from the delivered payload. */
  private accessNote(
    method: DeliveryMethod,
    payload: Record<string, unknown>,
  ): string {
    switch (method) {
      case DeliveryMethod.LICENSE_KEY:
        return `Your license key: ${String(payload.key)}`;
      case DeliveryMethod.SIGNED_DOWNLOAD:
        return `Download your files here (link expires soon): ${String(payload.downloadUrl)}`;
      case DeliveryMethod.WEBHOOK:
        return `Your purchase was delivered to the seller's system and will be provisioned automatically.`;
      case DeliveryMethod.COURSE_ACCESS:
        return `Your course access has been granted. Sign in to start learning.`;
      default:
        return `Your purchase has been delivered.`;
    }
  }

  /** Atomically claim one unused key from the product's pool. */
  private async claimLicenseKey(productId: string, orderId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const key = await tx.licenseKey.findFirst({
        where: { productId, claimedBy: null },
      });
      if (!key) throw new Error(`Out of license keys for product ${productId}`);
      await tx.licenseKey.update({
        where: { id: key.id },
        data: { claimedBy: orderId, claimedAt: new Date() },
      });
      return key.key;
    });
  }
}
