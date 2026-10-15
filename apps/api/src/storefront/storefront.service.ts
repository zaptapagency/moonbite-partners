import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Aggregate buyer rating attached to each storefront product. */
export interface RatingAggregate {
  count: number;
  average: number | null;
}

/**
 * Public, read-only creator storefront (Gumroad-style). Queries Prisma
 * directly so it stays independent of the authenticated products module.
 */
@Injectable()
export class StorefrontService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public storefront for `handle`: the creator's public profile plus their
   * active products (with cover image, price fields and a rating aggregate).
   * Throws 404 when no merchant owns the handle.
   */
  async getStorefront(handle: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { handle: handle.toLowerCase() },
      select: {
        id: true,
        displayName: true,
        handle: true,
        bio: true,
        avatarUrl: true,
      },
    });
    if (!merchant) throw new NotFoundException("Storefront not found");

    const products = await this.prisma.product.findMany({
      where: { merchantId: merchant.id, active: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        imageUrl: true,
        priceMbite: true,
        priceCurrency: true,
        displayUsd: true,
        pwyw: true,
        minPriceMbite: true,
      },
    });

    const ratingById = await this.ratingsFor(products.map((p) => p.id));

    return {
      merchant,
      products: products.map((p) => ({
        ...p,
        rating: ratingById.get(p.id) ?? { count: 0, average: null },
      })),
    };
  }

  /** Map productId → {count, average} using a single review groupBy. */
  private async ratingsFor(
    productIds: string[],
  ): Promise<Map<string, RatingAggregate>> {
    if (productIds.length === 0) return new Map();
    const groups = await this.prisma.review.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return new Map(
      groups.map((g) => {
        const avg = g._avg.rating;
        return [
          g.productId,
          {
            count: g._count._all,
            average: avg === null ? null : Math.round(avg * 100) / 100,
          },
        ];
      }),
    );
  }
}
