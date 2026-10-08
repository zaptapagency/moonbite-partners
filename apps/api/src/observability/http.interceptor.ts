import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import { MetricsService } from "./metrics.service";

/** Records request metrics and emits one structured JSON log line per request. */
@Injectable()
export class HttpObservabilityInterceptor implements NestInterceptor {
  private readonly log = new Logger("http");

  constructor(private readonly metrics: MetricsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== "http") return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const start = Date.now();

    const finalize = () => {
      const ms = Date.now() - start;
      this.metrics.record(res.statusCode, ms);
      // Skip the scrape endpoint to avoid log/metric feedback noise.
      if (req.url !== "/metrics") {
        this.log.log(
          JSON.stringify({ method: req.method, url: req.url, status: res.statusCode, ms }),
        );
      }
    };

    return next.handle().pipe(
      tap({ next: finalize, error: finalize }),
    );
  }
}
