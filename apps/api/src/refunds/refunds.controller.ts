import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentMerchant, AuthMerchant } from "../auth/current-merchant.decorator";
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

@Controller()
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  /** Buyer- or merchant-initiated; left open so a buyer can request without an account. */
  @Post("orders/:orderId/refunds")
  requestRefund(@Param("orderId") orderId: string, @Body() dto: RequestRefundDto) {
    return this.refunds.request(orderId, dto);
  }

  /** Merchant records the refund tx they broadcast — owner only. */
  @UseGuards(JwtAuthGuard)
  @Post("refunds/:id/submit")
  async submit(
    @CurrentMerchant() me: AuthMerchant,
    @Param("id") id: string,
    @Body() dto: SubmitRefundDto,
  ) {
    await this.refunds.assertOwner(id, me.id);
    return this.refunds.submit(id, dto.txid);
  }

  @UseGuards(JwtAuthGuard)
  @Post("refunds/:id/reject")
  async reject(
    @CurrentMerchant() me: AuthMerchant,
    @Param("id") id: string,
    @Body() dto: RejectRefundDto,
  ) {
    await this.refunds.assertOwner(id, me.id);
    return this.refunds.reject(id, dto.reason);
  }

  @Get("refunds/:id")
  get(@Param("id") id: string) {
    return this.refunds.get(id);
  }
}
