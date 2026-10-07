import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import { DeliveryMethod } from "@prisma/client";
import { ProductsService } from "./products.service";

class CreateProductDto {
  @IsString() merchantId!: string;
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  /** Price in smallest MBITE unit. */
  @IsInt() @Min(1) priceMbiteUnits!: number;
  @IsEnum(DeliveryMethod) deliveryMethod!: DeliveryMethod;
  @IsOptional() deliveryConfig?: unknown;
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

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create({
      merchantId: dto.merchantId,
      title: dto.title,
      description: dto.description,
      priceMbite: BigInt(dto.priceMbiteUnits),
      deliveryMethod: dto.deliveryMethod,
      deliveryConfig: dto.deliveryConfig,
    });
  }
}
