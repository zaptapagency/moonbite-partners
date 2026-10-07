import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HdAddressService } from "../mbite/hd-address.service";

@Injectable()
export class MerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hd: HdAddressService,
  ) {}

  create(input: { email: string; displayName: string }) {
    return this.prisma.merchant.create({ data: input });
  }

  /** Dashboard profile (safe fields only — never the password hash). */
  async profile(merchantId: string) {
    const m = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        email: true,
        displayName: true,
        tier: true,
        feeBps: true,
        settlementXpub: true,
        createdAt: true,
      },
    });
    if (!m) throw new NotFoundException("Merchant not found");
    return { ...m, xpubConfigured: Boolean(m.settlementXpub), settlementXpub: undefined };
  }

  myProducts(merchantId: string) {
    return this.prisma.product.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true, licenseKeys: true } } },
    });
  }

  myOrders(merchantId: string) {
    return this.prisma.order.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { product: { select: { title: true } }, refund: { select: { id: true, status: true } } },
    });
  }

  myRefunds(merchantId: string) {
    return this.prisma.refund.findMany({
      where: { order: { merchantId } },
      orderBy: { requestedAt: "desc" },
      include: { order: { select: { id: true, product: { select: { title: true } } } } },
    });
  }

  /** Attach the merchant's settlement xpub (non-custodial payout). */
  async setXpub(merchantId: string, xpub: string) {
    if (!this.hd.isValidXpub(xpub)) {
      throw new BadRequestException("Invalid MBITE xpub");
    }
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: { settlementXpub: xpub },
    });
  }

  /**
   * Atomically reserve the next derivation index for a merchant so two
   * concurrent orders never collide on the same address.
   */
  async reserveKeyIndex(merchantId: string): Promise<number> {
    const updated = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: { nextKeyIndex: { increment: 1 } },
      select: { nextKeyIndex: true },
    });
    return updated.nextKeyIndex - 1;
  }
}
