import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../delivery/storage.service";
import { BUYER_SCOPE } from "./buyer-scope";

export interface BuyerAuthResult {
  accessToken: string;
  buyer: { id: string; email: string };
}

/** One purchase row in the buyer's Library. */
export interface LibraryItem {
  orderId: string;
  status: string;
  productTitle: string;
  deliveryMethod: string;
  /** Short human-readable note on how/whether the product has been delivered. */
  deliverySummary: string;
  createdAt: string;
  /** Present only for FULFILLED orders: the delivered goods. */
  entitlement?: Record<string, unknown>;
}

@Injectable()
export class BuyerAuthService {
  private readonly log = new Logger(BuyerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Register (or claim) a buyer account. Upserts by email so a guest buyer who
   * already checked out is claimed in place — we set the passwordHash on the
   * existing row rather than creating a duplicate. Only conflicts (409) if the
   * email already has a password set.
   */
  async register(email: string, password: string): Promise<BuyerAuthResult> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.buyer.findUnique({ where: { email: normalized } });
    const passwordHash = await bcrypt.hash(password, 10);

    let buyer;
    if (existing) {
      if (existing.passwordHash) {
        throw new ConflictException("Email already registered");
      }
      buyer = await this.prisma.buyer.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
      this.log.log(`Claimed guest buyer ${buyer.id}`);
    } else {
      buyer = await this.prisma.buyer.create({
        data: { email: normalized, passwordHash },
      });
      this.log.log(`Registered buyer ${buyer.id}`);
    }
    return this.sign(buyer.id, buyer.email);
  }

  async login(email: string, password: string): Promise<BuyerAuthResult> {
    const normalized = email.trim().toLowerCase();
    const buyer = await this.prisma.buyer.findUnique({ where: { email: normalized } });
    if (!buyer?.passwordHash) throw new UnauthorizedException("Invalid credentials");

    const ok = await bcrypt.compare(password, buyer.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    return this.sign(buyer.id, buyer.email);
  }

  async me(buyerId: string): Promise<{ id: string; email: string; createdAt: string }> {
    const buyer = await this.prisma.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) throw new UnauthorizedException("Buyer not found");
    return { id: buyer.id, email: buyer.email, createdAt: buyer.createdAt.toISOString() };
  }

  /** The buyer's purchase Library — their orders, newest first. */
  async library(buyerId: string): Promise<LibraryItem[]> {
    const orders = await this.prisma.order.findMany({
      where: { buyerId },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { title: true, deliveryMethod: true } }, entitlement: true },
    });

    return orders.map((order) => {
      const item: LibraryItem = {
        orderId: order.id,
        status: order.status,
        productTitle: order.product.title,
        deliveryMethod: order.product.deliveryMethod,
        deliverySummary: this.deliverySummary(order.status, order.product.deliveryMethod),
        createdAt: order.createdAt.toISOString(),
      };

      if (order.status === "FULFILLED" && order.entitlement) {
        const payload = { ...(order.entitlement.payload as Record<string, unknown>) };
        // Mint a fresh signed download URL for file products, mirroring the
        // existing GET /orders/:id/entitlement behavior.
        if (typeof payload.objectKey === "string") {
          payload.downloadUrl = this.storage.buildSignedUrl(order.id, payload.objectKey);
        }
        item.entitlement = payload;
      }
      return item;
    });
  }

  private deliverySummary(status: string, method: string): string {
    if (status === "FULFILLED") {
      switch (method) {
        case "LICENSE_KEY":
          return "License key issued — available below.";
        case "SIGNED_DOWNLOAD":
          return "Files ready — download link available below.";
        case "WEBHOOK":
          return "Access provisioned via the merchant's system.";
        case "COURSE_ACCESS":
          return "Course access granted.";
        default:
          return "Delivered.";
      }
    }
    switch (status) {
      case "AWAITING_PAYMENT":
      case "DETECTED":
        return "Awaiting payment confirmation.";
      case "UNDERPAID":
        return "Underpaid — top up to complete.";
      case "OVERPAID":
      case "PAID":
        return "Paid — delivery in progress.";
      case "EXPIRED":
        return "Invoice expired — not delivered.";
      case "REFUNDED":
        return "Refunded.";
      case "CANCELLED":
        return "Cancelled.";
      default:
        return "Pending.";
    }
  }

  private sign(id: string, email: string): BuyerAuthResult {
    const accessToken = this.jwt.sign({ sub: id, email, scope: BUYER_SCOPE });
    return { accessToken, buyer: { id, email } };
  }
}
