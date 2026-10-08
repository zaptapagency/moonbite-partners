import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsString, MinLength } from "class-validator";
import { BuyerAuthService } from "./buyer-auth.service";
import { BuyerJwtGuard } from "./buyer-jwt.guard";
import { CurrentBuyer, AuthBuyer } from "./current-buyer.decorator";

class BuyerRegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}

class BuyerLoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}

@Controller("buyer")
export class BuyerAuthController {
  constructor(private readonly auth: BuyerAuthService) {}

  // 10 account creations per hour per IP (mirrors merchant auth).
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post("register")
  register(@Body() dto: BuyerRegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  // 5 login attempts per minute per IP — blunts credential-stuffing / brute force.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  login(@Body() dto: BuyerLoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(BuyerJwtGuard)
  @Get("me")
  me(@CurrentBuyer() me: AuthBuyer) {
    return this.auth.me(me.id);
  }

  @UseGuards(BuyerJwtGuard)
  @Get("library")
  library(@CurrentBuyer() me: AuthBuyer) {
    return this.auth.library(me.id);
  }
}
