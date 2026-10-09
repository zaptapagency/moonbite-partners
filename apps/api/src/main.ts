import "reflect-metadata";

// Money is stored as BigInt (smallest MBITE unit). JSON.stringify throws on
// BigInt, so serialize it as a decimal string across every API response.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return (this as unknown as bigint).toString();
};

import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Behind a reverse proxy/load balancer, trust X-Forwarded-For so rate limiting
  // keys off the real client IP rather than the proxy's. Enable only when the
  // proxy is trusted (TRUST_PROXY=1), otherwise clients could spoof the header.
  if (config.get("TRUST_PROXY")) {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }

  const origins = (config.get<string>("CORS_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : true });

  const port = config.get<number>("API_PORT") ?? 4000;
  await app.listen(port);
  new Logger("Bootstrap").log(`MoonBite Partners API listening on :${port}`);
}

void bootstrap();
