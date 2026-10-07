import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { RefundsService } from "./refunds.service";

class RequestRefundDto {
  @IsOptional() @IsString() reason?: string;
  /** Defaults to the buyer's return address collected at checkout. */
  @IsOptional() @IsString() refundAddress?: string;
}

class SubmitRefundDto {
  @IsString() @MinLength(16) txid!: string;
}

class RejectRefundDto {
  @IsOptional() @IsString() reason?: string;
}

/**
 * NOTE: these endpoints are unauthenticated in the scaffold. In production,
 * `request` is buyer- or merchant-initiated and `submit`/`reject` must be
 * guarded so only the owning merchant can act (PLAN.md §8).
 */
@Controller()
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Post("orders/:orderId/refunds")
  requestRefund(@Param("orderId") orderId: string, @Body() dto: RequestRefundDto) {
    return this.refunds.request(orderId, dto);
  }

  @Post("refunds/:id/submit")
  submit(@Param("id") id: string, @Body() dto: SubmitRefundDto) {
    return this.refunds.submit(id, dto.txid);
  }

  @Post("refunds/:id/reject")
  reject(@Param("id") id: string, @Body() dto: RejectRefundDto) {
    return this.refunds.reject(id, dto.reason);
  }

  @Get("refunds/:id")
  get(@Param("id") id: string) {
    return this.refunds.get(id);
  }
}
