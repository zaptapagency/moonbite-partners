import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { AdminRole } from "@prisma/client";
import type { AuthAdmin } from "./current-admin.decorator";

interface AdminJwtPayload {
  sub: string;
  email: string;
  role: AdminRole;
  /** Discriminates admin tokens from merchant/buyer tokens signed with the same secret. */
  kind: "admin";
}

/** Verifies a Bearer admin JWT and attaches `req.admin`. */
@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: AuthAdmin }>();
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Missing Bearer token");
    }
    try {
      const payload = this.jwt.verify<AdminJwtPayload>(token);
      if (payload.kind !== "admin") {
        throw new UnauthorizedException("Not an admin token");
      }
      req.admin = { id: payload.sub, email: payload.email, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
