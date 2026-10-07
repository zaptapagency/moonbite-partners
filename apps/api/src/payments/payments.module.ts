import { Module } from "@nestjs/common";
import { MbiteModule } from "../mbite/mbite.module";
import { MerchantsModule } from "../merchants/merchants.module";
import { PaymentsService } from "./payments.service";
import { DeliveryService } from "./delivery.service";
import { ConfirmationService } from "./confirmation.service";

@Module({
  imports: [MbiteModule, MerchantsModule],
  providers: [PaymentsService, DeliveryService, ConfirmationService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
