import { Module } from "@nestjs/common";
import { MbiteModule } from "../mbite/mbite.module";
import { RefundsService } from "./refunds.service";
import { RefundsController } from "./refunds.controller";

@Module({
  imports: [MbiteModule],
  providers: [RefundsService],
  controllers: [RefundsController],
  exports: [RefundsService],
})
export class RefundsModule {}
