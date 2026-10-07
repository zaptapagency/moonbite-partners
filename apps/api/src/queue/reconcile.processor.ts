import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PaymentsService } from "../payments/payments.service";
import { RefundsService } from "../refunds/refunds.service";
import {
  JOB_RECONCILE_ORDER,
  JOB_VERIFY_REFUND,
  RECONCILE_QUEUE,
  ReconcileOrderJob,
  VerifyRefundJob,
} from "./reconcile.constants";

/**
 * Worker that performs reconciliation. Thrown errors propagate to BullMQ, which
 * retries per the queue's attempts/backoff. `reconcile` and `verify` are
 * idempotent, so retries and duplicate deliveries are safe.
 */
@Processor(RECONCILE_QUEUE, { concurrency: 5 })
export class ReconcileProcessor extends WorkerHost {
  private readonly log = new Logger(ReconcileProcessor.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOB_RECONCILE_ORDER:
        await this.payments.reconcile((job.data as ReconcileOrderJob).orderId);
        return;
      case JOB_VERIFY_REFUND:
        await this.refunds.verify((job.data as VerifyRefundJob).refundId);
        return;
      default:
        this.log.warn(`Unknown job ${job.name} (${job.id})`);
    }
  }
}
