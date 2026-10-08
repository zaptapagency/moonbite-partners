import { Module } from "@nestjs/common";
import { PriceOracleService } from "./price-oracle.service";

/** Phase 2 USD pricing — exposes the MBITE/USD oracle to checkout. */
@Module({
  providers: [PriceOracleService],
  exports: [PriceOracleService],
})
export class PricingModule {}
