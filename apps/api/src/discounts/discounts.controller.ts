import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentMerchant, AuthMerchant } from "../auth/current-merchant.decorator";
import { DiscountsService } from "./discounts.service";

class CreateDiscountDto {
  @IsString() @MinLength(1) code!: string;
  /** Percent off (1..100) — provide this XOR amountOffUnits. */
  @IsOptional() @IsInt() @Min(1) @Max(100) percentOff?: number;
  /** Fixed amount off in smallest MBITE units — provide this XOR percentOff. */
  @IsOptional() @IsInt() @Min(1) amountOffUnits?: number;
  /** Scope the code to one product (must be yours); omit for all products. */
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @IsOptional() @IsISO8601() expiresAt?: string;
}

@Controller("discounts")
@UseGuards(JwtAuthGuard)
export class DiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  /** Create a discount code for the authenticated merchant. */
  @Post()
  create(@CurrentMerchant() me: AuthMerchant, @Body() dto: CreateDiscountDto) {
    return this.discounts.create(me.id, dto);
  }

  /** List the authenticated merchant's discount codes. */
  @Get()
  list(@CurrentMerchant() me: AuthMerchant) {
    return this.discounts.list(me.id);
  }

  /** Deactivate a discount code (soft-delete, owner only). */
  @Delete(":id")
  deactivate(@CurrentMerchant() me: AuthMerchant, @Param("id") id: string) {
    return this.discounts.deactivate(me.id, id);
  }
}
