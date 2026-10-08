import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentMerchant, AuthMerchant } from "../auth/current-merchant.decorator";
import { MerchantsService } from "./merchants.service";
import { HANDLE_PATTERN } from "./handle";

class SetXpubDto {
  @IsString() @MinLength(20) xpub!: string;
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Matches(HANDLE_PATTERN, {
    message:
      "handle must be 3–30 characters: lowercase letters, numbers and hyphens only",
  })
  handle?: string;

  @IsOptional() @IsString() @MaxLength(500) bio?: string;

  @IsOptional() @IsString() @MaxLength(1000) avatarUrl?: string;
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

  /** Set the public storefront profile: handle, bio, avatarUrl (owner only). */
  @Put("profile")
  updateProfile(@CurrentMerchant() me: AuthMerchant, @Body() dto: UpdateProfileDto) {
    return this.merchants.updateProfile(me.id, {
      handle: dto.handle,
      bio: dto.bio,
      avatarUrl: dto.avatarUrl,
    });
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
