import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PaymentsModule } from "../payments/payments.module";
import { RefundsModule } from "../refunds/refunds.module";
import { RECONCILE_QUEUE } from "./reconcile.constants";
import { ReconcileProcessor } from "./reconcile.processor";

/**
 * Worker side. Imports PaymentsModule + RefundsModule to do the real work.
 * PaymentsModule imports ReconcileQueueModule (producer only), so there is no
 * import cycle: processor → payments → queue(producer).
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: RECONCILE_QUEUE }),
    PaymentsModule,
    RefundsModule,
  ],
  providers: [ReconcileProcessor],
})
export class ReconcileProcessorModule {}
