import { Module } from "@nestjs/common";
import { MbiteModule } from "../mbite/mbite.module";
import { MerchantsModule } from "../merchants/merchants.module";
import { RefundsModule } from "../refunds/refunds.module";
import { ReconcileQueueModule } from "../queue/reconcile-queue.module";
import { PaymentsService } from "./payments.service";
import { DeliveryService } from "./delivery.service";
import { ConfirmationService } from "./confirmation.service";
import { ZmqListenerService } from "./zmq-listener.service";

@Module({
  imports: [MbiteModule, MerchantsModule, RefundsModule, ReconcileQueueModule],
  providers: [PaymentsService, DeliveryService, ConfirmationService, ZmqListenerService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
