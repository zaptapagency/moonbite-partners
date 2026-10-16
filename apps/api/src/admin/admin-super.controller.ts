import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsEnum, IsEmail, IsOptional, IsBoolean, IsString, MinLength } from "class-validator";
import { AdminRole } from "@prisma/client";
import { AdminJwtGuard } from "../admin-auth/admin-jwt.guard";
import { RolesGuard } from "../admin-auth/roles.guard";
import { Roles } from "../admin-auth/roles.decorator";
import { CurrentAdmin, AuthAdmin } from "../admin-auth/current-admin.decorator";
import { AdminSuperService } from "./admin-super.service";

class CreateAdminDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) displayName!: string;
  @IsString() @MinLength(8) password!: string;
  @IsEnum(AdminRole) role!: AdminRole;
}
class UpdateAdminDto {
  @IsOptional() @IsString() @MinLength(2) displayName?: string;
  @IsOptional() @IsEnum(AdminRole) role?: AdminRole;
  @IsOptional() @IsBoolean() active?: boolean;
}
class SettingDto {
  @IsString() @MinLength(1) key!: string;
  value!: unknown;
}

/** SUPER_ADMIN-only endpoints: staff management, settings, audit trail. */
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles("SUPER_ADMIN")
@Controller("admin/super")
export class AdminSuperController {
  constructor(private readonly svc: AdminSuperService) {}

  @Get("admins")
  listAdmins() {
    return this.svc.listAdmins();
  }
  @Post("admins")
  createAdmin(@CurrentAdmin() me: AuthAdmin, @Body() dto: CreateAdminDto) {
    return this.svc.createAdmin(me.id, dto);
  }
  @Put("admins/:id")
  updateAdmin(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string, @Body() dto: UpdateAdminDto) {
    return this.svc.updateAdmin(me.id, id, dto);
  }
  @Delete("admins/:id")
  deleteAdmin(@CurrentAdmin() me: AuthAdmin, @Param("id") id: string) {
    return this.svc.deleteAdmin(me.id, id);
  }

  @Get("settings")
  settings() {
    return this.svc.getSettings();
  }
  @Put("settings")
  setSetting(@CurrentAdmin() me: AuthAdmin, @Body() dto: SettingDto) {
    return this.svc.setSetting(me.id, dto.key, dto.value);
  }

  @Get("audit")
  audit(@Query("action") action?: string, @Query("targetId") targetId?: string) {
    return this.svc.listAudit({ action, targetId });
  }
}
