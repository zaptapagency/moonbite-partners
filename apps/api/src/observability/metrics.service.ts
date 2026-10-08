import { Injectable } from "@nestjs/common";

/**
 * Minimal, dependency-free metrics registry rendered in Prometheus text format
 * at GET /metrics. Tracks HTTP request counts + latency by status class. Enough
 * for a scrape target / dashboard without pulling in a client library.
 */
@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly countByClass = new Map<string, number>();
  private durationSumMs = 0;
  private durationCount = 0;

  record(statusCode: number, durationMs: number): void {
    const cls = `${Math.floor(statusCode / 100)}xx`;
    this.countByClass.set(cls, (this.countByClass.get(cls) ?? 0) + 1);
    this.durationSumMs += durationMs;
    this.durationCount += 1;
  }

  render(): string {
    const lines: string[] = [];
    lines.push("# HELP http_requests_total Total HTTP requests by status class.");
    lines.push("# TYPE http_requests_total counter");
    for (const [cls, n] of this.countByClass) {
      lines.push(`http_requests_total{status_class="${cls}"} ${n}`);
    }
    lines.push("# HELP http_request_duration_ms_sum Total request duration (ms).");
    lines.push("# TYPE http_request_duration_ms_sum counter");
    lines.push(`http_request_duration_ms_sum ${this.durationSumMs}`);
    lines.push("# HELP http_request_duration_ms_count Completed request count.");
    lines.push("# TYPE http_request_duration_ms_count counter");
    lines.push(`http_request_duration_ms_count ${this.durationCount}`);
    lines.push("# HELP process_uptime_seconds Process uptime.");
    lines.push("# TYPE process_uptime_seconds gauge");
    lines.push(`process_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`);
    return lines.join("\n") + "\n";
  }
}
