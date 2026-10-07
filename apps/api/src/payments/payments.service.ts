import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Order } from "@prisma/client";
import { InvoiceView } from "@moonbite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MbiteRpcClient } from "../mbite/mbite-rpc.client";
import { HdAddressService } from "../mbite/hd-address.service";
import { MerchantsService } from "../merchants/merchants.service";
import { DeliveryService } from "./delivery.service";
import { classifyPayment, coinsToUnits, feeFromBps, unitsToCoins } from "../common/money";

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
    const amount = product.priceMbite;
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
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    return {
      orderId: order.id,
      status: order.status,
      payToAddress: order.payToAddress,
      amountMbite: unitsToCoins(order.amountMbite),
      displayPrice: `${unitsToCoins(order.amountMbite)} MBITE`,
      confirmations: order.confirmations,
      requiredConfirmations: order.requiredConfirmations,
      expiresAt: order.quoteExpiresAt.getTime(),
    };
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

    // Already settled or dead — nothing to do.
    if (["FULFILLED", "EXPIRED", "REFUNDED", "CANCELLED"].includes(order.status)) {
      return order;
    }

    // Expire unpaid invoices past their quote window.
    if (order.status === "AWAITING_PAYMENT" && order.quoteExpiresAt < new Date()) {
      return this.prisma.order.update({
        where: { id: order.id },
        data: { status: "EXPIRED" },
      });
    }

    const scan = await this.rpc.scanAddress(order.payToAddress);
    const received = coinsToUnits(scan.total);
    if (received === 0n) return order;

    // Determine confirmations from the shallowest funding UTXO.
    const tipHeight = await this.rpc.getBlockCount();
    const minHeight = Math.min(...scan.utxos.map((u) => u.height).filter((h) => h > 0));
    const confirmations = Number.isFinite(minHeight) ? tipHeight - minHeight + 1 : 0;

    const band = classifyPayment(order.amountMbite, received, this.tolerance);
    let status = order.status;
    if (band === "under") status = "UNDERPAID";
    else if (confirmations >= order.requiredConfirmations) status = "PAID";
    else status = "DETECTED";

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        receivedMbite: received,
        confirmations,
        txid: scan.utxos[0]?.txid ?? order.txid,
        status,
        paidAt: status === "PAID" && !order.paidAt ? new Date() : order.paidAt,
      },
      include: { product: true },
    });

    if (status === "PAID") {
      try {
        await this.delivery.fulfill(updated);
      } catch (e) {
        // Stay PAID and alert — money is in, delivery will be retried.
        this.log.error(`Delivery failed for ${order.id}: ${String(e)}`);
      }
    }
    return updated;
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
