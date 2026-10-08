import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DeliveryMethod, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Method-specific delivery config a merchant can set (Workstream B §4). */
export interface DeliveryConfigInput {
  objectKey?: string;
  webhookUrl?: string;
  webhookSecret?: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      include: { merchant: { select: { displayName: true } } },
    });
  }

  get(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  create(input: {
    merchantId: string;
    title: string;
    description?: string;
    priceMbite: bigint;
    priceCurrency?: string;
    priceUsd?: number;
    category?: string;
    deliveryMethod: DeliveryMethod;
    deliveryConfig?: unknown;
  }) {
    return this.prisma.product.create({
      data: {
        merchantId: input.merchantId,
        title: input.title,
        description: input.description,
        priceMbite: input.priceMbite,
        priceCurrency: input.priceCurrency ?? "MBITE",
        displayUsd: input.priceUsd ?? undefined,
        category: input.category,
        deliveryMethod: input.deliveryMethod,
        deliveryConfig: (input.deliveryConfig as object) ?? undefined,
      },
    });
  }

  /** Load a product and assert it belongs to the caller (owner-only ops). */
  private async ownedProduct(productId: string, merchantId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("Product not found");
    if (product.merchantId !== merchantId) {
      throw new ForbiddenException("Not your product");
    }
    return product;
  }

  /**
   * Bulk-add license keys to a product's pool (Workstream B §4). Blank/duplicate
   * entries are ignored. Returns how many were added.
   */
  async addLicenseKeys(
    merchantId: string,
    productId: string,
    keys: string[],
  ): Promise<{ added: number }> {
    await this.ownedProduct(productId, merchantId);
    const cleaned = Array.from(
      new Set(keys.map((k) => k.trim()).filter((k) => k.length > 0)),
    );
    if (cleaned.length === 0) return { added: 0 };
    const result = await this.prisma.licenseKey.createMany({
      data: cleaned.map((key) => ({ productId, key })),
    });
    return { added: result.count };
  }

  /**
   * Set a product's delivery config (objectKey / webhookUrl / webhookSecret),
   * merging over any existing config (Workstream B §4). Never echoes secrets.
   */
  async setDeliveryConfig(
    merchantId: string,
    productId: string,
    config: DeliveryConfigInput,
  ): Promise<{ id: string; deliveryMethod: string; hasWebhookSecret: boolean }> {
    const product = await this.ownedProduct(productId, merchantId);
    const existing = (product.deliveryConfig ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...existing };
    if (config.objectKey !== undefined) merged.objectKey = config.objectKey;
    if (config.webhookUrl !== undefined) merged.webhookUrl = config.webhookUrl;
    if (config.webhookSecret !== undefined) merged.webhookSecret = config.webhookSecret;

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { deliveryConfig: merged as Prisma.InputJsonObject },
    });
    return {
      id: updated.id,
      deliveryMethod: updated.deliveryMethod,
      hasWebhookSecret: Boolean(merged.webhookSecret),
    };
  }
}
