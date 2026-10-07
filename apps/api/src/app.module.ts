import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { MbiteModule } from "./mbite/mbite.module";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { RefundsModule } from "./refunds/refunds.module";
import { MerchantsModule } from "./merchants/merchants.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MbiteModule,
    MerchantsModule,
    ProductsModule,
    PaymentsModule,
    RefundsModule,
    OrdersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
