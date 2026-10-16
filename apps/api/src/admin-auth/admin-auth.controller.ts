import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsString, MinLength } from "class-validator";
import { AdminAuthService } from "./admin-auth.service";
import { AdminJwtGuard } from "./admin-jwt.guard";
import { CurrentAdmin, AuthAdmin } from "./current-admin.decorator";

class AdminLoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}

@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  // 5 login attempts per minute per IP — blunt brute force on the admin door.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  login(@Body() dto: AdminLoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(AdminJwtGuard)
  @Get("me")
  me(@CurrentAdmin() me: AuthAdmin) {
    return this.auth.me(me.id);
  }
}
