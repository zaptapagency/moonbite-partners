import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AdminRole } from "@prisma/client";
import { ROLES_KEY } from "./roles.decorator";
import type { AuthAdmin } from "./current-admin.decorator";

/**
 * Enforces @Roles(...) metadata. Must run AFTER AdminJwtGuard so `req.admin`
 * is set. SUPER_ADMIN implicitly satisfies any ADMIN-only requirement.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ admin?: AuthAdmin }>();
    const role = req.admin?.role;
    if (!role) throw new ForbiddenException("No admin role");

    // SUPER_ADMIN can do anything an ADMIN can.
    if (role === "SUPER_ADMIN") return true;
    if (required.includes(role)) return true;

    throw new ForbiddenException("Insufficient admin role");
  }
}
