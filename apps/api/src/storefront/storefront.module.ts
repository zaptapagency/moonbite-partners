import { Module } from "@nestjs/common";
import { StorefrontService } from "./storefront.service";
import { StorefrontController } from "./storefront.controller";

@Module({
  providers: [StorefrontService],
  controllers: [StorefrontController],
})
export class StorefrontModule {}
