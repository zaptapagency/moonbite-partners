import { SetMetadata } from "@nestjs/common";
import type { AdminRole } from "@prisma/client";

export const ROLES_KEY = "admin_roles";

/** Restrict a handler/controller to the given admin roles (used with RolesGuard). */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
