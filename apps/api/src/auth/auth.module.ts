import { Global, Module, Logger } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./jwt-auth.guard";

/**
 * Global so JwtService + JwtAuthGuard are available to any controller that
 * applies `@UseGuards(JwtAuthGuard)` without each module re-importing JwtModule.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");
        if (!secret) {
          new Logger("AuthModule").warn(
            "JWT_SECRET not set — using an insecure dev default. Set it before production.",
          );
        }
        return {
          secret: secret ?? "dev-insecure-secret-change-me",
          signOptions: { expiresIn: config.get("JWT_EXPIRES_IN") ?? "7d" },
        };
      },
    }),
  ],
  providers: [AuthService, JwtAuthGuard],
  controllers: [AuthController],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
