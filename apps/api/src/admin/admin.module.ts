import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AdminService } from "./admin.service";
import { AdminSuperService } from "./admin-super.service";
import { AdminController } from "./admin.controller";
import { AdminSuperController } from "./admin-super.controller";

/** Platform operator back-office: dashboards, moderation, staff, settings, audit. */
@Module({
  providers: [AuditService, AdminService, AdminSuperService],
  controllers: [AdminController, AdminSuperController],
})
export class AdminModule {}
