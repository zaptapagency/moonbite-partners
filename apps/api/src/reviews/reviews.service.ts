import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { checkReviewEligibility } from "./review-eligibility";

export interface CreateReviewInput {
  orderId: string;
  rating: number;
  comment?: string;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reviews for a product, newest first. */
  list(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Leave a review on a product. Allowed only when the order exists, is for
   * this product, and is FULFILLED (checkReviewEligibility). One review per
   * order is enforced by the `@unique orderId` — a duplicate yields 409.
   */
  async create(productId: string, input: CreateReviewInput) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      select: { status: true, productId: true, buyerRef: true },
    });

    const eligibility = checkReviewEligibility({
      orderExists: order != null,
      orderStatus: order?.status,
      orderProductId: order?.productId,
      targetProductId: productId,
      rating: input.rating,
    });
    if (!eligibility.ok) {
      switch (eligibility.code) {
        case "bad_rating":
          throw new BadRequestException(eligibility.reason);
        case "not_found":
          throw new NotFoundException(eligibility.reason);
        default:
          throw new ForbiddenException(eligibility.reason);
      }
    }

    const comment = input.comment?.trim();
    try {
      return await this.prisma.review.create({
        data: {
          productId,
          orderId: input.orderId,
          rating: input.rating,
          comment: comment ? comment : undefined,
          buyerRef: order?.buyerRef ?? undefined,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("This order has already been reviewed");
      }
      throw e;
    }
  }
}
