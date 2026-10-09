import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { IsOptional, IsString } from "class-validator";
import type { Request } from "express";
import { OnrampService } from "./onramp.service";

class QuoteDto {
  @IsString() productId!: string;
}
class SessionDto {
  @IsString() quoteId!: string;
  @IsOptional() @IsString() buyerRef?: string;
}

@Controller("onramp")
export class OnrampController {
  constructor(private readonly onramp: OnrampService) {}

  /** Lock a fiat price for a product. */
  @Post("quote")
  quote(@Body() dto: QuoteDto) {
    return this.onramp.quote(dto.productId);
  }

  /** Turn a quote into a FIAT order + hosted-provider session handoff. */
  @Post("session")
  session(@Body() dto: SessionDto) {
    return this.onramp.createSession(dto.quoteId, dto.buyerRef);
  }

  /** Provider settlement webhook (HMAC-verified over the raw body). */
  @SkipThrottle()
  @Post("webhook")
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-onramp-signature") signature?: string,
  ) {
    return this.onramp.handleWebhook(req.rawBody ?? Buffer.from(""), signature);
  }

  @Get("status/:orderId")
  status(@Param("orderId") orderId: string) {
    return this.onramp.status(orderId);
  }
}
