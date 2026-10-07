import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

/** Tokens are emailed as raw strings but only their sha256 is stored at rest. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
const isProd = () => process.env.NODE_ENV === "production";

export interface AuthResult {
  accessToken: string;
  merchant: { id: string; email: string; displayName: string };
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string, displayName: string): Promise<AuthResult> {
    const existing = await this.prisma.merchant.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(password, 10);
    const merchant = await this.prisma.merchant.create({
      data: { email, displayName, passwordHash },
    });
    return this.sign(merchant.id, merchant.email, merchant.displayName);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const merchant = await this.prisma.merchant.findUnique({ where: { email } });
    if (!merchant?.passwordHash) throw new UnauthorizedException("Invalid credentials");

    const ok = await bcrypt.compare(password, merchant.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    return this.sign(merchant.id, merchant.email, merchant.displayName);
  }

  // ── Email verification ────────────────────────────────────────────────
  /** Issue a verification token. Returned only in non-prod; prod emails it (TODO: mail). */
  async requestEmailVerification(merchantId: string): Promise<{ sent: boolean; token?: string }> {
    const token = randomBytes(32).toString("hex");
    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        emailVerifyToken: hashToken(token),
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    this.log.log(`Email verification requested for ${merchantId}`);
    // TODO(mail): send the raw token/link to the merchant's email.
    return isProd() ? { sent: true } : { sent: true, token };
  }

  async verifyEmail(token: string): Promise<{ verified: boolean }> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { emailVerifyToken: hashToken(token), emailVerifyExpires: { gt: new Date() } },
    });
    if (!merchant) throw new BadRequestException("Invalid or expired verification token");
    await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
    });
    return { verified: true };
  }

  // ── Password reset ────────────────────────────────────────────────────
  /** Always returns the same shape to avoid leaking which emails exist. */
  async requestPasswordReset(email: string): Promise<{ sent: boolean; token?: string }> {
    const merchant = await this.prisma.merchant.findUnique({ where: { email } });
    if (!merchant) return { sent: true }; // do not reveal non-existence
    const token = randomBytes(32).toString("hex");
    await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        passwordResetToken: hashToken(token),
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    this.log.log(`Password reset requested for ${merchant.id}`);
    // TODO(mail): send the raw token/link to the merchant's email.
    return isProd() ? { sent: true } : { sent: true, token };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ reset: boolean }> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { passwordResetToken: hashToken(token), passwordResetExpires: { gt: new Date() } },
    });
    if (!merchant) throw new BadRequestException("Invalid or expired reset token");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    });
    return { reset: true };
  }

  private sign(id: string, email: string, displayName: string): AuthResult {
    const accessToken = this.jwt.sign({ sub: id, email });
    return { accessToken, merchant: { id, email, displayName } };
  }
}
