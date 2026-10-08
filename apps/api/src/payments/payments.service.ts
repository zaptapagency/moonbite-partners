import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Order } from "@prisma/client";
import { InvoiceView, OrderStatus, isTerminal } from "@moonbite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MbiteRpcClient } from "../mbite/mbite-rpc.client";
import { HdAddressService } from "../mbite/hd-address.service";
import { MerchantsService } from "../merchants/merchants.service";
import { StorageService } from "../delivery/storage.service";
import { DeliveryService } from "./delivery.service";
import { decideNextStatus } from "./order-state-machine";
import { coinsToUnits, feeFromBps, unitsToCoins } from "../common/money";
import { PriceOracleService } from "../pricing/price-oracle.service";

/**
 * Invoice lifecycle — the heart of the platform (PLAN.md §4).
 * State transitions live here; see @moonbite/shared OrderStatus.
 */
@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);
  private readonly requiredConfs: number;
  private readonly quoteTtlMs: number;
  private readonly tolerance: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rpc: MbiteRpcClient,
    private readonly hd: HdAddressService,
    private readonly merchants: MerchantsService,
    private readonly delivery: DeliveryService,
    private readonly storage: StorageService,
    private readonly oracle: PriceOracleService,
    config: ConfigService,
  ) {
    this.requiredConfs = Number(config.get("PAYMENT_CONFIRMATIONS") ?? 2);
    this.quoteTtlMs = Number(config.get("QUOTE_TTL_SECONDS") ?? 900) * 1000;
    this.tolerance = Number(config.get("PAYMENT_TOLERANCE") ?? 0.02);
  }

  /** Create an invoice: derive a fresh address, lock the amount + quote. */
  async createInvoice(input: {
    productId: string;
    buyerReturnAddress?: string;
    buyerRef?: string;
  }): Promise<Order> {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      include: { merchant: true },
    });
    if (!product || !product.active) throw new NotFoundException("Product not available");
    if (!product.merchant.settlementXpub) {
      throw new BadRequestException("Merchant has not configured a settlement xpub");
    }

    const index = await this.merchants.reserveKeyIndex(product.merchantId);
    const payToAddress = this.hd.deriveAddress(product.merchant.settlementXpub, index);

    // Lock the MBITE amount at quote time. For USD-priced products we convert
    // via the price oracle; the resolved rate is frozen into amountMbite so the
    // quote cannot drift even if the oracle moves before the buyer pays.
    let amount: bigint;
    if (product.priceCurrency === "USD") {
      if (product.displayUsd == null) {
        throw new BadRequestException("USD-priced product is missing its USD price (displayUsd)");
      }
      const usd = Number(product.displayUsd);
      const mbitePerUsd = await this.oracle.getMbitePerUsd();
      amount = this.oracle.usdToMbiteUnits(usd);
      this.log.log(
        `Quote ${product.id}: $${usd} locked at ${mbitePerUsd} MBITE/USD → ${unitsToCoins(amount)} MBITE`,
      );
    } else {
      amount = product.priceMbite;
    }
    const fee = feeFromBps(amount, product.merchant.feeBps);

    return this.prisma.order.create({
      data: {
        merchantId: product.merchantId,
        productId: product.id,
        status: "AWAITING_PAYMENT",
        payToAddress,
        derivationIndex: index,
        amountMbite: amount,
        feeMbite: fee,
        requiredConfirmations: this.requiredConfs,
        buyerReturnAddress: input.buyerReturnAddress,
        buyerRef: input.buyerRef,
        quoteExpiresAt: new Date(Date.now() + this.quoteTtlMs),
      },
    });
  }

  async getInvoiceView(orderId: string): Promise<InvoiceView> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    const amountCoins = unitsToCoins(order.amountMbite);
    const view: InvoiceView = {
      orderId: order.id,
      status: order.status,
      payToAddress: order.payToAddress,
      amountMbite: amountCoins,
      displayPrice: `${amountCoins} MBITE`,
      confirmations: order.confirmations,
      requiredConfirmations: order.requiredConfirmations,
      expiresAt: order.quoteExpiresAt.getTime(),
    };

    if (order.product.priceCurrency === "USD" && order.product.displayUsd != null) {
      const usd = Number(order.product.displayUsd);
      view.priceCurrency = "USD";
      view.displayUsd = usd;
      // The rate locked at quote time, recovered from the frozen MBITE amount.
      view.mbitePerUsd = usd > 0 ? Number(amountCoins) / usd : 0;
      view.displayPrice = `$${usd.toFixed(2)} (${amountCoins} MBITE)`;
    } else {
      view.priceCurrency = "MBITE";
    }
    return view;
  }

  /**
   * Reconcile one order against the chain. Called by ConfirmationService
   * (poll) and, in production, by the ZMQ listener on each new tx/block.
   * Pure forward-only transitions; safe to call repeatedly (idempotent).
   */
  async reconcile(orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    // Terminal — nothing to do, and skip the RPC round-trips.
    const current = order.status as unknown as OrderStatus;
    if (isTerminal(current)) return order;

    const scan = await this.rpc.scanAddress(order.payToAddress);
    const received = coinsToUnits(scan.total);

    // Confirmations come from the shallowest funding UTXO (0 if none yet).
    let confirmations = 0;
    if (received > 0n) {
      const heights = scan.utxos.map((u) => u.height).filter((h) => h > 0);
      if (heights.length) {
        const tipHeight = await this.rpc.getBlockCount();
        confirmations = tipHeight - Math.min(...heights) + 1;
      }
    }

    // All transition policy lives in the pure state machine.
    const status = decideNextStatus({
      current,
      quoteExpired: order.quoteExpiresAt < new Date(),
      amountUnits: order.amountMbite,
      receivedUnits: received,
      confirmations,
      requiredConfirmations: order.requiredConfirmations,
      tolerance: this.tolerance,
    });

    // Nothing on-chain and no status change → avoid a pointless write.
    if (received === 0n && status === current) return order;

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        receivedMbite: received,
        confirmations,
        txid: scan.utxos[0]?.txid ?? order.txid,
        status: status as unknown as Order["status"],
        paidAt: status === OrderStatus.PAID && !order.paidAt ? new Date() : order.paidAt,
      },
      include: { product: true },
    });

    if (status === OrderStatus.PAID) {
      try {
        await this.delivery.fulfill(updated);
      } catch (e) {
        // Stay PAID and alert — money is in, delivery will be retried.
        this.log.error(`Delivery failed for ${order.id}: ${String(e)}`);
      }
    }
    return updated;
  }

  /**
   * The buyer's entitlement for a FULFILLED order (Workstream B §5). The
   * orderId is the bearer capability. 404 until the order is fulfilled. For
   * signed downloads we re-mint a fresh short-lived URL from the stored
   * objectKey so the returned link is always currently valid.
   */
  async getEntitlement(orderId: string): Promise<Record<string, unknown>> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { entitlement: true },
    });
    if (!order || order.status !== "FULFILLED" || !order.entitlement) {
      throw new NotFoundException("Entitlement not available");
    }

    const payload = { ...(order.entitlement.payload as Record<string, unknown>) };
    if (typeof payload.objectKey === "string") {
      payload.downloadUrl = this.storage.buildSignedUrl(order.id, payload.objectKey);
    }
    return payload;
  }

  /** Orders that still need chain reconciliation. */
  openOrders() {
    return this.prisma.order.findMany({
      where: { status: { in: ["AWAITING_PAYMENT", "DETECTED", "OVERPAID"] } },
      select: { id: true },
    });
  }

  /**
   * Open orders whose pay-to address appears in `addresses`. Used by the ZMQ
   * listener to reconcile only the orders a just-seen transaction touches.
   */
  async findOpenByAddresses(addresses: string[]): Promise<string[]> {
    if (addresses.length === 0) return [];
    const rows = await this.prisma.order.findMany({
      where: {
        payToAddress: { in: addresses },
        status: { in: ["AWAITING_PAYMENT", "DETECTED", "OVERPAID"] },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
