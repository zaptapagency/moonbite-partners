import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsString, MinLength } from "class-validator";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentMerchant, AuthMerchant } from "./current-merchant.decorator";

class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(2) displayName!: string;
}

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}

class ForgotPasswordDto {
  @IsEmail() email!: string;
}

class ResetPasswordDto {
  @IsString() @MinLength(16) token!: string;
  @IsString() @MinLength(8) password!: string;
}

class VerifyEmailDto {
  @IsString() @MinLength(16) token!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // 10 account creations per hour per IP.
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.displayName);
  }

  // 5 login attempts per minute per IP — blunts credential-stuffing / brute force.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentMerchant() merchant: AuthMerchant) {
    return merchant;
  }

  // Issue a verification token for the signed-in merchant.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @UseGuards(JwtAuthGuard)
  @Post("email/verify/request")
  requestEmailVerification(@CurrentMerchant() me: AuthMerchant) {
    return this.auth.requestEmailVerification(me.id);
  }

  @Post("email/verify")
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  // 5 reset requests per hour per IP.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post("password/forgot")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post("password/reset")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }
}
