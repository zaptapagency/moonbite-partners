import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { HdAddressService } from "../mbite/hd-address.service";
import { isValidHandle } from "./handle";

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
        handle: true,
        bio: true,
        avatarUrl: true,
        tier: true,
        feeBps: true,
        settlementXpub: true,
        createdAt: true,
      },
    });
    if (!m) throw new NotFoundException("Merchant not found");
    return { ...m, xpubConfigured: Boolean(m.settlementXpub), settlementXpub: undefined };
  }

  /**
   * Update the merchant's public storefront profile. `handle` is validated
   * (lowercase slug, 3..30 chars) and must be unique across merchants —
   * a clash raises 409. Only provided fields are changed.
   */
  async updateProfile(
    merchantId: string,
    input: { handle?: string; bio?: string | null; avatarUrl?: string | null },
  ) {
    const data: Prisma.MerchantUpdateInput = {};

    if (input.handle !== undefined) {
      const handle = input.handle.trim().toLowerCase();
      if (!isValidHandle(handle)) {
        throw new BadRequestException(
          "Handle must be 3–30 characters: lowercase letters, numbers and hyphens only",
        );
      }
      const existing = await this.prisma.merchant.findUnique({
        where: { handle },
        select: { id: true },
      });
      if (existing && existing.id !== merchantId) {
        throw new ConflictException("That handle is already taken");
      }
      data.handle = handle;
    }
    if (input.bio !== undefined) data.bio = input.bio;
    if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;

    try {
      await this.prisma.merchant.update({ where: { id: merchantId }, data });
    } catch (e) {
      // Unique-constraint race: another merchant grabbed the handle concurrently.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("That handle is already taken");
      }
      throw e;
    }
    return this.profile(merchantId);
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
