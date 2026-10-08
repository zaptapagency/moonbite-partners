import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";
import { HttpObservabilityInterceptor } from "./http.interceptor";

/** Structured request logging + Prometheus /metrics (PLAN.md §8 observability). */
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpObservabilityInterceptor },
  ],
})
export class ObservabilityModule {}
