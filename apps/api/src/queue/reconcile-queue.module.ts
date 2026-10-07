import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { RECONCILE_QUEUE } from "./reconcile.constants";
import { ReconcileProducer } from "./reconcile.producer";

/**
 * Producer side of the reconciliation queue. Imported by modules that enqueue
 * work (PaymentsModule). Deliberately has NO app-service dependencies so it
 * can be imported by PaymentsModule without creating a cycle with the processor.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: RECONCILE_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        // Free the jobId as soon as work finishes so the next event/poll can
        // re-enqueue the same order/refund. Failures are retried by the poller.
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
  ],
  providers: [ReconcileProducer],
  exports: [ReconcileProducer],
})
export class ReconcileQueueModule {}
