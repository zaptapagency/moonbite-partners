import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "./payments.service";

/**
 * BACKSTOP reconciler. The PRIMARY trigger is now ZmqListenerService, which
 * reconciles orders the instant the node pushes a rawtx/rawblock event. This
 * slow poll only catches events that ZMQ missed (listener down, node ZMQ off,
 * dropped frame) and expires stale quotes. Interval is deliberately long;
 * override with CONFIRMATION_POLL_MS.
 *
 * TODO(scale): move reconciliation onto a BullMQ queue so it runs on workers
 * and retries cleanly, rather than inline in this loop.
 */
@Injectable()
export class ConfirmationService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConfirmationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly pollMs: number;

  constructor(
    private readonly payments: PaymentsService,
    config: ConfigService,
  ) {
    this.pollMs = Number(config.get("CONFIRMATION_POLL_MS") ?? 60_000);
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), this.pollMs);
    this.log.log(`Confirmation backstop poller started (every ${this.pollMs}ms)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // avoid overlap if a scan runs long
    this.running = true;
    try {
      const open = await this.payments.openOrders();
      for (const { id } of open) {
        try {
          await this.payments.reconcile(id);
        } catch (e) {
          this.log.warn(`Reconcile ${id} failed: ${String(e)}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
