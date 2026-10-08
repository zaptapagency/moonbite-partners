import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { BuyerAuthService } from "./buyer-auth.service";
import { BuyerAuthController } from "./buyer-auth.controller";
import { BuyerJwtGuard } from "./buyer-jwt.guard";

/**
 * Buyer accounts + purchase Library. Distinct from the merchant AuthModule:
 * tokens carry a `scope: "buyer"` claim and are validated by BuyerJwtGuard.
 * JwtService comes from the global AuthModule; StorageService (from
 * DeliveryModule) mints fresh download links for the Library.
 */
@Module({
  imports: [PrismaModule, DeliveryModule],
  providers: [BuyerAuthService, BuyerJwtGuard],
  controllers: [BuyerAuthController],
})
export class BuyerAuthModule {}
