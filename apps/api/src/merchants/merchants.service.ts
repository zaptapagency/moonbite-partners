import { BadRequestException, Injectable } from "@nestjs/common";
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
