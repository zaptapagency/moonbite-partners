import {
  Controller,
  Get,
  GoneException,
  NotFoundException,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "./storage.service";

/**
 * Public, capability-based download endpoint (Workstream B §1).
 *
 * The URL itself is the capability: a valid HMAC signature over
 * orderId+objectKey+exp, minted at fulfillment. We 302-redirect to the real
 * object only when the order is FULFILLED and the signature both matches and is
 * unexpired. Bad signature → 404 (do not reveal why); expired → 410.
 */
@Controller("download")
export class DownloadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get(":orderId")
  async download(
    @Param("orderId") orderId: string,
    @Query("exp") expRaw: string,
    @Query("sig") sig: string,
    @Res() res: Response,
  ): Promise<void> {
    const exp = Number(expRaw);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    // An order that isn't fulfilled has nothing to hand out. 404 (not 403) so we
    // leak nothing about which orders exist or their state.
    if (!order || order.status !== "FULFILLED") {
      throw new NotFoundException("Not found");
    }

    const config = (order.product.deliveryConfig ?? {}) as { objectKey?: unknown };
    const objectKey = typeof config.objectKey === "string" ? config.objectKey : "";
    if (!objectKey) throw new NotFoundException("Not found");

    if (!sig || !this.storage.verify(orderId, objectKey, exp, sig)) {
      throw new NotFoundException("Not found");
    }
    if (this.storage.isExpired(exp)) {
      throw new GoneException("This download link has expired");
    }

    res.redirect(302, this.storage.objectUrl(objectKey));
  }
}
