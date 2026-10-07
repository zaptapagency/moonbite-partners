import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

/**
 * Drives reconciliation of open invoices.
 *
 * This scaffold uses a simple polling loop as a dependable fallback. In
 * production the PRIMARY trigger should be the node's ZMQ `rawtx`/`rawblock`
 * push notifications (PLAN.md §3): subscribe, and on each event reconcile the
 * affected / all-open orders. Polling then only backstops missed events.
 *
 * TODO(Phase 1): add a ZMQ subscriber (e.g. `zeromq` pkg) that calls
 * paymentsService.reconcile(orderId) on relevant tx, and move this poll to a
 * long interval. Also move reconciliation onto a BullMQ queue so it scales
 * horizontally and retries cleanly.
 */
@Injectable()
export class ConfirmationService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConfirmationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private static readonly POLL_MS = 15_000;

  constructor(private readonly payments: PaymentsService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), ConfirmationService.POLL_MS);
    this.log.log(`Confirmation poller started (every ${ConfirmationService.POLL_MS}ms)`);
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
