import { Module } from "@nestjs/common";
import { MbiteRpcClient } from "./mbite-rpc.client";
import { HdAddressService } from "./hd-address.service";

@Module({
  providers: [MbiteRpcClient, HdAddressService],
  exports: [MbiteRpcClient, HdAddressService],
})
export class MbiteModule {}
