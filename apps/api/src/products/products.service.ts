import { Injectable } from "@nestjs/common";
import { DeliveryMethod } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

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
    deliveryMethod: DeliveryMethod;
    deliveryConfig?: unknown;
  }) {
    return this.prisma.product.create({
      data: {
        merchantId: input.merchantId,
        title: input.title,
        description: input.description,
        priceMbite: input.priceMbite,
        deliveryMethod: input.deliveryMethod,
        deliveryConfig: (input.deliveryConfig as object) ?? undefined,
      },
    });
  }
}
