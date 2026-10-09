import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { PriceOracleService } from "../pricing/price-oracle.service";
import { PaymentsService } from "../payments/payments.service";
import { unitsToCoins } from "../common/money";
import { computeFiatQuote } from "./quote-math";

/**
 * Fiat on-ramp orchestration (ONRAMP.md). Scaffold of the license-free parts:
 * a quote engine and a webhook-funded order path. The actual card charge + KYC
 * live with a LICENSED PROVIDER (not here); this service locks a quote, creates
 * a FIAT order, and — on the provider's settlement webhook — marks it funded and
 * delivers (reusing the normal delivery pipeline).
 */
@Injectable()
export class OnrampService {
  private readonly log = new Logger(OnrampService.name);
  private readonly spreadBps: number;
  private readonly quoteTtlMs: number;
  private readonly webhookSecret: string;
  private readonly provider: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly oracle: PriceOracleService,
    private readonly payments: PaymentsService,
    config: ConfigService,
  ) {
    this.spreadBps = Number(config.get("ONRAMP_SPREAD_BPS") ?? 300);
    this.quoteTtlMs = Number(config.get("ONRAMP_QUOTE_TTL_SECONDS") ?? 600) * 1000;
    this.webhookSecret = config.get<string>("ONRAMP_WEBHOOK_SECRET") ?? "dev-onramp-webhook-secret";
    this.provider = config.get<string>("ONRAMP_PROVIDER") ?? "mock";
  }

  /** Lock a fiat price for a product (MBITE amount × oracle rate × (1+spread)). */
  async quote(productId: string) {
    const mbiteAmount = await this.payments.baseAmountMbite(productId);
    const mbitePerUsd = await this.oracle.getMbitePerUsd();
    const q = computeFiatQuote(mbiteAmount, mbitePerUsd, this.spreadBps);

    const quote = await this.prisma.quote.create({
      data: {
        productId,
        mbiteAmount,
        fiatCurrency: "USD",
        fiatAmount: q.fiatAmount,
        spreadBps: q.spreadBps,
        mbitePerUsd,
        expiresAt: new Date(Date.now() + this.quoteTtlMs),
      },
    });

    return {
      quoteId: quote.id,
      productId,
      mbiteAmount: unitsToCoins(mbiteAmount),
      fiatAmount: q.fiatAmount,
      fiatCurrency: "USD",
      spreadBps: q.spreadBps,
      mbitePerUsd,
      expiresAt: quote.expiresAt.getTime(),
    };
  }

  /**
   * Turn a quote into a FIAT order + a (stub) hosted-provider session the buyer
   * would be redirected to. Marks the quote USED.
   */
  async createSession(quoteId: string, buyerRef?: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) throw new NotFoundException("Quote not found");
    if (quote.status !== "PENDING") throw new BadRequestException("Quote already used");
    if (quote.expiresAt < new Date()) {
      await this.prisma.quote.update({ where: { id: quoteId }, data: { status: "EXPIRED" } });
      throw new BadRequestException("Quote expired — request a new one");
    }

    const providerRef = `onr_${randomBytes(12).toString("hex")}`;
    const order = await this.payments.createFiatOrder({
      productId: quote.productId,
      mbiteAmount: quote.mbiteAmount,
      fiatAmount: Number(quote.fiatAmount),
      fiatCurrency: quote.fiatCurrency,
      providerRef,
      buyerRef,
    });
    await this.prisma.quote.update({ where: { id: quoteId }, data: { status: "USED" } });

    // In production this is the licensed provider's hosted-checkout URL.
    const hostedUrl = `${this.publicBase()}/onramp/mock/${providerRef}`;
    this.log.log(`Fiat session ${providerRef} for order ${order.id} via ${this.provider}`);
    return { orderId: order.id, providerRef, provider: this.provider, hostedUrl };
  }

  /**
   * Provider settlement webhook. Verifies the HMAC signature over the raw body,
   * then marks the referenced order funded and delivers. Idempotent.
   */
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.verify(rawBody, signature)) {
      throw new BadRequestException("Invalid webhook signature");
    }
    let event: { providerRef?: string; status?: string };
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new BadRequestException("Malformed webhook body");
    }
    if (!event.providerRef) throw new BadRequestException("Missing providerRef");

    const order = await this.payments.findByProviderRef(event.providerRef);
    if (!order) throw new NotFoundException("Order not found for providerRef");

    if (event.status === "settled" || event.status === "completed") {
      await this.payments.settleOffchain(order.id);
      return { ok: true, orderId: order.id, status: "settled" };
    }
    // Other provider statuses (failed/refunded) could cancel the order here.
    this.log.warn(`Unhandled onramp status '${event.status}' for ${order.id}`);
    return { ok: true, orderId: order.id, status: event.status ?? "unknown" };
  }

  async status(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentRoute !== "FIAT_ONRAMP") {
      throw new NotFoundException("Fiat order not found");
    }
    return {
      orderId: order.id,
      status: order.status,
      fiatAmount: order.fiatAmount ? Number(order.fiatAmount) : null,
      fiatCurrency: order.fiatCurrency,
      mbiteAmount: unitsToCoins(order.amountMbite),
    };
  }

  /** HMAC-SHA256 over the raw body, constant-time compared. */
  private verify(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "hex");
    let b: Buffer;
    try {
      b = Buffer.from(signature, "hex");
    } catch {
      return false;
    }
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private publicBase(): string {
    return process.env.PUBLIC_BASE_URL ?? "http://localhost:4000";
  }
}
