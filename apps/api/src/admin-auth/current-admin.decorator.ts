import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AdminRole } from "@prisma/client";

/** The authenticated admin identity attached by AdminJwtGuard. */
export interface AuthAdmin {
  id: string;
  email: string;
  role: AdminRole;
}

/** Inject the current admin: `@CurrentAdmin() me: AuthAdmin`. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthAdmin => {
    const req = ctx.switchToHttp().getRequest<{ admin: AuthAdmin }>();
    return req.admin;
  },
);
