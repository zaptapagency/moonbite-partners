import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  JOB_RECONCILE_ORDER,
  JOB_VERIFY_REFUND,
  RECONCILE_QUEUE,
  ReconcileOrderJob,
  VerifyRefundJob,
} from "./reconcile.constants";

/**
 * Enqueues reconciliation work. Producers (ZMQ listener, backstop poller) call
 * this instead of touching PaymentsService/RefundsService directly, so the
 * actual chain checks run on the worker with retries + backoff and never block
 * the producer. A stable `jobId` dedupes bursts (e.g. every open order being
 * re-enqueued on each new block) while a job is still waiting/active.
 */
@Injectable()
export class ReconcileProducer {
  private readonly log = new Logger(ReconcileProducer.name);

  constructor(@InjectQueue(RECONCILE_QUEUE) private readonly queue: Queue) {}

  async enqueueOrder(orderId: string): Promise<void> {
    try {
      await this.queue.add(
        JOB_RECONCILE_ORDER,
        { orderId } satisfies ReconcileOrderJob,
        { jobId: `order:${orderId}` },
      );
    } catch (e) {
      this.log.warn(`Failed to enqueue order ${orderId}: ${String(e)}`);
    }
  }

  async enqueueRefund(refundId: string): Promise<void> {
    try {
      await this.queue.add(
        JOB_VERIFY_REFUND,
        { refundId } satisfies VerifyRefundJob,
        { jobId: `refund:${refundId}` },
      );
    } catch (e) {
      this.log.warn(`Failed to enqueue refund ${refundId}: ${String(e)}`);
    }
  }
}
