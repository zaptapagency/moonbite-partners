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
