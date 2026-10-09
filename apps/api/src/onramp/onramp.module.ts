import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { PaymentsModule } from "../payments/payments.module";
import { OnrampService } from "./onramp.service";
import { OnrampController } from "./onramp.controller";

/** Fiat on-ramp: quote engine + webhook-funded order path (ONRAMP.md). */
@Module({
  imports: [PricingModule, PaymentsModule],
  providers: [OnrampService],
  controllers: [OnrampController],
})
export class OnrampModule {}
