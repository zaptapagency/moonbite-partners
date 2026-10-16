import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import type { AdminRole, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "./audit.service";

/** SUPER_ADMIN-only operations: manage staff, platform settings, read the trail. */
@Injectable()
export class AdminSuperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Admin staff ───────────────────────────────────────────────────────────
  listAdmins() {
    return this.prisma.admin.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true, email: true, displayName: true, role: true, active: true,
        lastLoginAt: true, createdAt: true,
      },
    });
  }

  async createAdmin(
    actingId: string,
    input: { email: string; displayName: string; password: string; role: AdminRole },
  ) {
    const exists = await this.prisma.admin.findUnique({ where: { email: input.email } });
    if (exists) throw new BadRequestException("Email already registered");
    const passwordHash = await bcrypt.hash(input.password, 10);
    const admin = await this.prisma.admin.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        role: input.role,
      },
      select: { id: true, email: true, displayName: true, role: true, active: true, createdAt: true },
    });
    await this.audit.record(actingId, "admin.create", { type: "Admin", id: admin.id }, { role: input.role });
    return admin;
  }

  async updateAdmin(
    actingId: string,
    id: string,
    patch: { displayName?: string; role?: AdminRole; active?: boolean },
  ) {
    const target = await this.prisma.admin.findUnique({ where: { id } });
    if (!target) throw new NotFoundException("Admin not found");
    // Guard: don't let the last active super-admin be demoted or disabled.
    if (target.role === "SUPER_ADMIN" && (patch.role === "ADMIN" || patch.active === false)) {
      const supers = await this.prisma.admin.count({ where: { role: "SUPER_ADMIN", active: true } });
      if (supers <= 1) throw new BadRequestException("Cannot remove the last active super-admin");
    }
    if (id === actingId && patch.active === false) {
      throw new BadRequestException("You cannot deactivate yourself");
    }
    const data: Prisma.AdminUpdateInput = {};
    if (patch.displayName !== undefined) data.displayName = patch.displayName;
    if (patch.role !== undefined) data.role = patch.role;
    if (patch.active !== undefined) data.active = patch.active;
    const admin = await this.prisma.admin.update({
      where: { id },
      data,
      select: { id: true, email: true, displayName: true, role: true, active: true },
    });
    await this.audit.record(actingId, "admin.update", { type: "Admin", id }, patch as Record<string, unknown>);
    return admin;
  }

  async deleteAdmin(actingId: string, id: string) {
    if (id === actingId) throw new ForbiddenException("You cannot delete yourself");
    const target = await this.prisma.admin.findUnique({ where: { id } });
    if (!target) throw new NotFoundException("Admin not found");
    if (target.role === "SUPER_ADMIN") {
      const supers = await this.prisma.admin.count({ where: { role: "SUPER_ADMIN", active: true } });
      if (supers <= 1) throw new BadRequestException("Cannot delete the last super-admin");
    }
    // Keep the audit trail intact: null out the FK by deleting the admin row
    // (AuditLog.adminId is ON DELETE SET NULL).
    await this.prisma.admin.delete({ where: { id } });
    await this.audit.record(actingId, "admin.delete", { type: "Admin", id }, { email: target.email });
    return { id, deleted: true };
  }

  // ── Platform settings ──────────────────────────────────────────────────────
  async getSettings() {
    const rows = await this.prisma.platformSetting.findMany();
    const map: Record<string, unknown> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  async setSetting(actingId: string, key: string, value: unknown) {
    if (!key.trim()) throw new BadRequestException("key required");
    const row = await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
    await this.audit.record(actingId, "settings.set", { type: "PlatformSetting", id: key }, { value });
    return row;
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  async listAudit(opts: { action?: string; targetId?: string }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (opts.action?.trim()) where.action = { contains: opts.action.trim() };
    if (opts.targetId?.trim()) where.targetId = opts.targetId.trim();
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true, action: true, targetType: true, targetId: true,
        metadata: true, createdAt: true,
        admin: { select: { email: true, displayName: true } },
      },
    });
  }
}
