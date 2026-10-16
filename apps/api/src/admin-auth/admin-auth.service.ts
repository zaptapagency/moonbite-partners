import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { AdminRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AdminAuthResult {
  accessToken: string;
  admin: { id: string; email: string; displayName: string; role: AdminRole };
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AdminAuthResult> {
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    if (!admin || !admin.active) throw new UnauthorizedException("Invalid credentials");

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.jwt.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      kind: "admin",
    });
    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        role: admin.role,
      },
    };
  }

  async me(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: { id: true, email: true, displayName: true, role: true, lastLoginAt: true, createdAt: true },
    });
    if (!admin) throw new UnauthorizedException("Admin not found");
    return admin;
  }
}
