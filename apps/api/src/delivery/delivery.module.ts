import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageService } from "./storage.service";
import { WebhookService } from "./webhook.service";
import { DownloadController } from "./download.controller";

/**
 * Delivery primitives shared by the fulfillment path (Workstream B):
 * signed-download minting/verification and outbound webhook delivery, plus the
 * public {@link DownloadController}. Kept separate from PaymentsModule so the
 * payment pipeline can depend on these without a cycle.
 */
@Module({
  imports: [PrismaModule],
  providers: [StorageService, WebhookService],
  controllers: [DownloadController],
  exports: [StorageService, WebhookService],
})
export class DeliveryModule {}
