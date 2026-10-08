import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from "class-validator";
import { DeliveryMethod } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentMerchant, AuthMerchant } from "../auth/current-merchant.decorator";
import { ProductsService } from "./products.service";

class CreateProductDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  /** Price in smallest MBITE unit (used when priceCurrency = MBITE). */
  @IsOptional() @IsInt() @Min(0) priceMbiteUnits?: number;
  /** "MBITE" (default) or "USD" — USD prices convert to MBITE at checkout. */
  @IsOptional() @IsString() priceCurrency?: string;
  /** USD price (required when priceCurrency = USD). */
  @IsOptional() @IsNumber() @Min(0.01) priceUsd?: number;
  @IsOptional() @IsString() category?: string;
  @IsEnum(DeliveryMethod) deliveryMethod!: DeliveryMethod;
  @IsOptional() deliveryConfig?: unknown;
}

class AddKeysDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) keys!: string[];
}

class SetDeliveryDto {
  @IsOptional() @IsString() objectKey?: string;
  @IsOptional() @IsUrl({ require_tld: false }) webhookUrl?: string;
  @IsOptional() @IsString() @MinLength(16) webhookSecret?: string;
}

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.products.get(id);
  }

  /** Create a product for the authenticated merchant (merchantId comes from the token). */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentMerchant() me: AuthMerchant, @Body() dto: CreateProductDto) {
    return this.products.create({
      merchantId: me.id,
      title: dto.title,
      description: dto.description,
      priceMbite: BigInt(dto.priceMbiteUnits ?? 0),
      priceCurrency: dto.priceCurrency,
      priceUsd: dto.priceUsd,
      category: dto.category,
      deliveryMethod: dto.deliveryMethod,
      deliveryConfig: dto.deliveryConfig,
    });
  }

  /** Bulk-add license keys to a product's pool (owner only). */
  @UseGuards(JwtAuthGuard)
  @Post(":id/keys")
  addKeys(
    @CurrentMerchant() me: AuthMerchant,
    @Param("id") id: string,
    @Body() dto: AddKeysDto,
  ) {
    return this.products.addLicenseKeys(me.id, id, dto.keys);
  }

  /** Set delivery config: objectKey / webhookUrl / webhookSecret (owner only). */
  @UseGuards(JwtAuthGuard)
  @Put(":id/delivery")
  setDelivery(
    @CurrentMerchant() me: AuthMerchant,
    @Param("id") id: string,
    @Body() dto: SetDeliveryDto,
  ) {
    return this.products.setDeliveryConfig(me.id, id, dto);
  }
}
