import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PriceOracleService } from "./price-oracle.service";

/**
 * Public MBITE/USD rate for display-only USD estimates. Prices are MBITE-native;
 * this is just so the web can show a "~$X" hint next to the MBITE price.
 */
@SkipThrottle()
@Controller("pricing")
export class PricingController {
  constructor(private readonly oracle: PriceOracleService) {}

  @Get("rate")
  async rate() {
    const mbitePerUsd = await this.oracle.getMbitePerUsd();
    return {
      mbitePerUsd,
      usdPerMbite: mbitePerUsd > 0 ? 1 / mbitePerUsd : null,
    };
  }
}
