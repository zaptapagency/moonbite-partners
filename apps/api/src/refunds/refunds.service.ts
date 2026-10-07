import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Refund } from "@prisma/client";
import { isTerminal, OrderStatus } from "@moonbite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MbiteRpcClient } from "../mbite/mbite-rpc.client";
import { HdAddressService } from "../mbite/hd-address.service";
import { coinsToUnits } from "../common/money";
import { verifyRefund } from "./refund-verification";

/**
 * Non-custodial refund workflow (PLAN.md §4). The platform never moves funds:
 * it records the request, the merchant sends MBITE back from their own wallet
 * and submits the txid, and this service verifies that tx on-chain before
 * flipping the order to REFUNDED and revoking any entitlement.
 */
@Injectable()
export class RefundsService {
  private readonly log = new Logger(RefundsService.name);
  private readonly requiredConfs: number;
  private readonly tolerance: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rpc: MbiteRpcClient,
    private readonly hd: HdAddressService,
    config: ConfigService,
  ) {
    this.requiredConfs = Number(
      config.get("REFUND_CONFIRMATIONS") ?? config.get("PAYMENT_CONFIRMATIONS") ?? 2,
    );
    this.tolerance = Number(config.get("PAYMENT_TOLERANCE") ?? 0.02);
  }

  /** Open a refund request for an order. One refund per order (v1 = full refund). */
  async request(
    orderId: string,
    input: { reason?: string; refundAddress?: string; amountUnits?: bigint },
  ): Promise<Refund> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { refund: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.refund) throw new BadRequestException("A refund already exists for this order");

    // Only orders that actually received funds and aren't already dead/refunded.
    if (order.receivedMbite <= 0n) {
      throw new BadRequestException("Nothing to refund — no funds were received");
    }
    const status = order.status as unknown as OrderStatus;
    if (isTerminal(status) && status !== OrderStatus.FULFILLED) {
      throw new BadRequestException(`Cannot refund an order in ${order.status}`);
    }

    const refundAddress = input.refundAddress ?? order.buyerReturnAddress ?? undefined;
    if (!refundAddress) {
      throw new BadRequestException(
        "No refund address: none was collected at checkout and none supplied",
      );
    }
    if (!this.hd.isValidAddress(refundAddress)) {
      throw new BadRequestException("Invalid MBITE refund address");
    }

    const amount = input.amountUnits ?? order.receivedMbite;
    if (amount <= 0n || amount > order.receivedMbite) {
      throw new BadRequestException("Refund amount must be > 0 and <= amount received");
    }

    return this.prisma.refund.create({
      data: {
        orderId,
        status: "REQUESTED",
        reason: input.reason,
        refundAddress,
        amountMbite: amount,
      },
    });
  }

  /** Merchant records the refund tx they broadcast, then we try to verify it. */
  async submit(refundId: string, txid: string): Promise<Refund> {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException("Refund not found");
    if (refund.status === "CONFIRMED" || refund.status === "REJECTED") {
      throw new BadRequestException(`Refund already ${refund.status}`);
    }
    await this.prisma.refund.update({
      where: { id: refundId },
      data: { status: "SUBMITTED", txid, submittedAt: new Date() },
    });
    return this.verify(refundId);
  }

  /** Merchant declines the request. */
  async reject(refundId: string, reason?: string): Promise<Refund> {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException("Refund not found");
    if (refund.status === "CONFIRMED") {
      throw new BadRequestException("Cannot reject an already-confirmed refund");
    }
    return this.prisma.refund.update({
      where: { id: refundId },
      data: { status: "REJECTED", reason: reason ?? refund.reason, rejectedAt: new Date() },
    });
  }

  /**
   * Check a SUBMITTED refund's tx on-chain. On success: Refund→CONFIRMED,
   * Order→REFUNDED, entitlement revoked. Idempotent and safe to re-run (called
   * on submit and by the backstop poller as confirmations accrue).
   */
  async verify(refundId: string): Promise<Refund> {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException("Refund not found");
    if (refund.status !== "SUBMITTED" || !refund.txid) return refund;

    let tx: { confirmations: number; outputs: Array<{ address?: string; value: number }> };
    try {
      tx = await this.rpc.getTxPayments(refund.txid);
    } catch (e) {
      this.log.warn(`Refund ${refundId} tx not found yet: ${String(e)}`);
      return refund; // tx not visible yet — try again next poll
    }

    const verdict = verifyRefund(
      {
        confirmations: tx.confirmations,
        outputs: tx.outputs.map((o) => ({
          address: o.address,
          valueUnits: coinsToUnits(o.value),
        })),
      },
      refund.refundAddress,
      refund.amountMbite,
      this.requiredConfs,
      this.tolerance,
    );

    if (verdict === "CONFIRMED") {
      await this.prisma.$transaction([
        this.prisma.refund.update({
          where: { id: refundId },
          data: { status: "CONFIRMED", confirmations: tx.confirmations, confirmedAt: new Date() },
        }),
        this.prisma.order.update({
          where: { id: refund.orderId },
          data: { status: "REFUNDED" },
        }),
        this.prisma.entitlement.updateMany({
          where: { orderId: refund.orderId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
      this.log.log(`Refund ${refundId} confirmed; order ${refund.orderId} → REFUNDED`);
      return this.prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    }

    // Not yet confirmed — record progress; leave status SUBMITTED to retry.
    this.log.debug(`Refund ${refundId} verdict=${verdict} (confs ${tx.confirmations})`);
    return this.prisma.refund.update({
      where: { id: refundId },
      data: { confirmations: tx.confirmations },
    });
  }

  get(refundId: string) {
    return this.prisma.refund.findUnique({ where: { id: refundId } });
  }

  /** SUBMITTED refunds awaiting on-chain confirmation — polled as a backstop. */
  submittedRefunds() {
    return this.prisma.refund.findMany({
      where: { status: "SUBMITTED" },
      select: { id: true },
    });
  }
}
