import { Injectable, Logger } from "@nestjs/common";
import { DeliveryMethod, Order, Prisma, Product } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Turns a PAID order into a delivered product (PLAN.md §6). Idempotent:
 * calling twice for the same order must not issue two keys. Delivery is the
 * last step of the happy path: PAID → FULFILLED.
 */
@Injectable()
export class DeliveryService {
  private readonly log = new Logger(DeliveryService.name);

  constructor(private readonly prisma: PrismaService) {}

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
  }

  private async buildPayload(
    order: Order & { product: Product },
  ): Promise<Record<string, unknown>> {
    switch (order.product.deliveryMethod) {
      case DeliveryMethod.LICENSE_KEY:
        return { key: await this.claimLicenseKey(order.productId, order.id) };

      case DeliveryMethod.SIGNED_DOWNLOAD:
        // TODO: mint a short-lived signed URL (S3/R2) from deliveryConfig.objectKey.
        return { downloadUrl: `https://cdn.moonbite.example/stub/${order.id}` };

      case DeliveryMethod.WEBHOOK:
        // TODO: POST to merchant webhook with a signed payload; await 2xx.
        return { webhook: "dispatched", at: new Date().toISOString() };

      case DeliveryMethod.COURSE_ACCESS:
        return { access: "granted", courseRef: order.productId };

      default:
        return {};
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
