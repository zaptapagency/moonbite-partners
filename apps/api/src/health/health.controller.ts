import { Controller, Get } from "@nestjs/common";
import { MbiteRpcClient } from "../mbite/mbite-rpc.client";

@Controller("health")
export class HealthController {
  constructor(private readonly rpc: MbiteRpcClient) {}

  @Get()
  async check() {
    const node = await this.rpc.pingSafe();
    return {
      status: "ok",
      time: new Date().toISOString(),
      node,
    };
  }
}
