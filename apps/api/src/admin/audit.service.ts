import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Writes the append-only admin audit trail. Never throws into the caller. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    adminId: string,
    action: string,
    target?: { type?: string; id?: string },
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          adminId,
          action,
          targetType: target?.type,
          targetId: target?.id,
          metadata: metadata ? (metadata as object) : undefined,
        },
      });
    } catch {
      /* auditing must never break the primary action */
    }
  }
}
