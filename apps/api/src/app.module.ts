import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "./prisma/prisma.module";
import { ReconcileProcessorModule } from "./queue/reconcile-processor.module";
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
    // Global default rate limit (per client IP). Auth routes tighten this
    // further with @Throttle (see auth.controller.ts).
    // NOTE: default storage is in-memory and per-instance. For multiple API
    // instances, plug in a Redis storage adapter (we already run Redis) so the
    // limit is shared — see PLAN.md §3/§8.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get("THROTTLE_TTL") ?? 60_000),
            limit: Number(config.get("THROTTLE_LIMIT") ?? 120),
          },
        ],
      }),
    }),
    // Shared Redis connection for all BullMQ queues/workers.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>("REDIS_URL") ?? "redis://localhost:6379");
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            username: url.username || undefined,
            password: url.password || undefined,
          },
        };
      },
    }),
    PrismaModule,
    AuthModule,
    MbiteModule,
    MerchantsModule,
    ProductsModule,
    PaymentsModule,
    RefundsModule,
    OrdersModule,
    ReconcileProcessorModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
