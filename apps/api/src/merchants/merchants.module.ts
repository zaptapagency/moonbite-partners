import { Module } from "@nestjs/common";
import { MbiteModule } from "../mbite/mbite.module";
import { MerchantsService } from "./merchants.service";
import { MerchantsController } from "./merchants.controller";

@Module({
  imports: [MbiteModule],
  providers: [MerchantsService],
  controllers: [MerchantsController],
  exports: [MerchantsService],
})
export class MerchantsModule {}
