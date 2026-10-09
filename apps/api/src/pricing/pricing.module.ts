import { Module } from "@nestjs/common";
import { PriceOracleService } from "./price-oracle.service";

/**
 * Price oracle — dormant. Products are MBITE-native (MBITE-only, no fiat).
 * Kept so a USD-priced product could still convert at checkout if ever enabled,
 * but nothing in the UI exposes fiat.
 */
@Module({
  providers: [PriceOracleService],
  exports: [PriceOracleService],
})
export class PricingModule {}
