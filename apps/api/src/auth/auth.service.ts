import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

export interface AuthResult {
  accessToken: string;
  merchant: { id: string; email: string; displayName: string };
}

@Injectable()
export class AuthService {
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

  private sign(id: string, email: string, displayName: string): AuthResult {
    const accessToken = this.jwt.sign({ sub: id, email });
    return { accessToken, merchant: { id, email, displayName } };
  }
}
