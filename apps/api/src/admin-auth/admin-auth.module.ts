import { Global, Module } from "@nestjs/common";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminJwtGuard } from "./admin-jwt.guard";
import { RolesGuard } from "./roles.guard";

/**
 * Global so AdminJwtGuard + RolesGuard are available to the admin feature
 * controllers. Reuses the global JwtModule exported by AuthModule.
 */
@Global()
@Module({
  providers: [AdminAuthService, AdminJwtGuard, RolesGuard],
  controllers: [AdminAuthController],
  exports: [AdminJwtGuard, RolesGuard],
})
export class AdminAuthModule {}
