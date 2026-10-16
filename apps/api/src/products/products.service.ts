import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DeliveryMethod, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Method-specific delivery config a merchant can set (Workstream B §4). */
export interface DeliveryConfigInput {
  objectKey?: string;
  webhookUrl?: string;
  webhookSecret?: string;
}

/** Aggregate buyer rating attached to a product (Phase 2 discovery). */
export interface RatingAggregate {
  /** Number of reviews. */
  count: number;
  /** Mean rating (1..5) rounded to 2dp, or null when there are no reviews. */
  average: number | null;
}

/** Optional filters for the public catalog listing (Phase 2 discovery). */
export interface ProductListQuery {
  /** Case-insensitive substring matched against title OR description. */
  q?: string;
  /** Exact category slug match. */
  category?: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public catalog listing. With no params it returns every active product
   * (newest first), unchanged from before. Optional `q` does a case-insensitive
   * title/description contains, and `category` filters by exact slug. Each row
   * carries an aggregate buyer rating (count + average).
   */
  async list(query: ProductListQuery = {}) {
    // Public catalog hides taken-down products and suspended merchants.
    const where: Prisma.ProductWhereInput = { active: true, merchant: { suspended: false } };
    const q = query.q?.trim();
    const category = query.category?.trim();
    if (category) where.category = category;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    const products = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { merchant: { select: { displayName: true } } },
    });
    return this.withRatings(products);
  }

  /** Distinct, non-null categories of active products (sorted). */
  async categories(): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { active: true, category: { not: null }, merchant: { suspended: false } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return rows
      .map((r) => r.category)
      .filter((c): c is string => c != null && c.length > 0);
  }

  async get(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { merchant: { select: { displayName: true } } },
    });
    if (!product) return null;
    const [withRating] = await this.withRatings([product]);
    return withRating;
  }

  /** Attach a {count, average} rating aggregate to each product row. */
  private async withRatings<T extends { id: string }>(
    products: T[],
  ): Promise<(T & { rating: RatingAggregate })[]> {
    if (products.length === 0) return [];
    const groups = await this.prisma.review.groupBy({
      by: ["productId"],
      where: { productId: { in: products.map((p) => p.id) } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const byId = new Map(groups.map((g) => [g.productId, g]));
    return products.map((p) => {
      const g = byId.get(p.id);
      const avg = g?._avg.rating ?? null;
      return {
        ...p,
        rating: {
          count: g?._count._all ?? 0,
          average: avg === null ? null : Math.round(avg * 100) / 100,
        },
      };
    });
  }

  create(input: {
    merchantId: string;
    title: string;
    description?: string;
    priceMbite: bigint;
    priceCurrency?: string;
    priceUsd?: number;
    category?: string;
    imageUrl?: string;
    pwyw?: boolean;
    minPriceMbite?: bigint;
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
        imageUrl: input.imageUrl,
        pwyw: input.pwyw ?? false,
        minPriceMbite: input.minPriceMbite,
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
