import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "./payments.service";
import { RefundsService } from "../refunds/refunds.service";
import { ReconcileProducer } from "../queue/reconcile.producer";

/**
 * BACKSTOP sweeper. The PRIMARY trigger is ZmqListenerService, which enqueues
 * reconciliation the instant the node pushes a rawtx/rawblock event. This slow
 * poll only re-enqueues work the events missed (listener down, node ZMQ off,
 * dropped frame) and re-drives stuck jobs (including failed ones, whose jobId
 * was freed). It only enqueues — the BullMQ worker does the chain checks.
 * Interval is deliberately long; override with CONFIRMATION_POLL_MS.
 */
@Injectable()
export class ConfirmationService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConfirmationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly pollMs: number;

  constructor(
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
    private readonly queue: ReconcileProducer,
    config: ConfigService,
  ) {
    this.pollMs = Number(config.get("CONFIRMATION_POLL_MS") ?? 60_000);
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), this.pollMs);
    this.log.log(`Confirmation backstop sweeper started (every ${this.pollMs}ms)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // avoid overlapping sweeps
    this.running = true;
    try {
      const open = await this.payments.openOrders();
      for (const { id } of open) await this.queue.enqueueOrder(id);

      // Re-drive submitted refunds as their confirmations accrue.
      const refunds = await this.refunds.submittedRefunds();
      for (const { id } of refunds) await this.queue.enqueueRefund(id);
    } catch (e) {
      this.log.warn(`Backstop sweep failed: ${String(e)}`);
    } finally {
      this.running = false;
    }
  }
}
