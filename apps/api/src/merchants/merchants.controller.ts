import { Body, Controller, Param, Post, Put } from "@nestjs/common";
import { IsEmail, IsString, MinLength } from "class-validator";
import { MerchantsService } from "./merchants.service";

class CreateMerchantDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) displayName!: string;
}

class SetXpubDto {
  @IsString() @MinLength(20) xpub!: string;
}

@Controller("merchants")
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Post()
  create(@Body() dto: CreateMerchantDto) {
    return this.merchants.create(dto);
  }

  @Put(":id/xpub")
  setXpub(@Param("id") id: string, @Body() dto: SetXpubDto) {
    return this.merchants.setXpub(id, dto.xpub);
  }
}
