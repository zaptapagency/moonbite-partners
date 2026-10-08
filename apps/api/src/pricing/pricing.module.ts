import { Module } from "@nestjs/common";
import { PriceOracleService } from "./price-oracle.service";
import { PricingController } from "./pricing.controller";

/** Phase 2 USD pricing — exposes the MBITE/USD oracle to checkout + the web. */
@Module({
  providers: [PriceOracleService],
  controllers: [PricingController],
  exports: [PriceOracleService],
})
export class PricingModule {}
