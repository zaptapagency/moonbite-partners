import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentMerchant, AuthMerchant } from "../auth/current-merchant.decorator";
import { MerchantsService } from "./merchants.service";

class SetXpubDto {
  @IsString() @MinLength(20) xpub!: string;
}

/** All merchant-self (dashboard) endpoints. Authenticated; scoped to the token. */
@UseGuards(JwtAuthGuard)
@Controller("merchants/me")
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Get()
  profile(@CurrentMerchant() me: AuthMerchant) {
    return this.merchants.profile(me.id);
  }

  @Put("xpub")
  setXpub(@CurrentMerchant() me: AuthMerchant, @Body() dto: SetXpubDto) {
    return this.merchants.setXpub(me.id, dto.xpub);
  }

  @Get("products")
  products(@CurrentMerchant() me: AuthMerchant) {
    return this.merchants.myProducts(me.id);
  }

  @Get("orders")
  orders(@CurrentMerchant() me: AuthMerchant) {
    return this.merchants.myOrders(me.id);
  }

  @Get("refunds")
  refunds(@CurrentMerchant() me: AuthMerchant) {
    return this.merchants.myRefunds(me.id);
  }
}
