import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { validateDiscountInput, type DiscountInput } from "./discount-validation";

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a discount code for the authenticated merchant. */
  async create(merchantId: string, input: DiscountInput & { productId?: string }) {
    const result = validateDiscountInput(input);
    if (!result.ok) throw new BadRequestException(result.reason);
    const value = result.value;

    // A product-scoped code must point at one of the merchant's own products.
    if (input.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: input.productId },
        select: { merchantId: true },
      });
      if (!product) throw new NotFoundException("Product not found");
      if (product.merchantId !== merchantId) {
        throw new ForbiddenException("Not your product");
      }
    }

    try {
      return await this.prisma.discount.create({
        data: {
          merchantId,
          code: value.code,
          percentOff: value.percentOff ?? undefined,
          amountOffMbite: value.amountOffUnits != null ? BigInt(value.amountOffUnits) : undefined,
          productId: input.productId ?? undefined,
          maxRedemptions: value.maxRedemptions ?? undefined,
          expiresAt: value.expiresAt ?? undefined,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("You already have a discount with that code");
      }
      throw e;
    }
  }

  /** List the merchant's discount codes (newest first). */
  list(merchantId: string) {
    return this.prisma.discount.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { id: true, title: true } } },
    });
  }

  /** Deactivate (soft-delete) a discount — owner only. */
  async deactivate(merchantId: string, id: string) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Discount not found");
    if (existing.merchantId !== merchantId) {
      throw new ForbiddenException("Not your discount");
    }
    return this.prisma.discount.update({
      where: { id },
      data: { active: false },
    });
  }
}
