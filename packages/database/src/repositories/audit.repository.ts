import type { Prisma, PrismaClient, Severity } from '@prisma/client';
import { getClientIp, getUserAgent, type HttpRequestContext } from '@secureauthx/shared';

/**
 * Audit trail and security-event persistence. Every security-relevant
 * action writes a structured record with the request context attached.
 */
export class AuditRepository {
  constructor(private readonly db: PrismaClient) {}

  async log(
    userId: string | null,
    action: string,
    severity: Severity,
    req?: HttpRequestContext,
    metadata?: Prisma.InputJsonValue
  ): Promise<void> {
    await this.db.auditLog.create({
      data: {
        userId,
        action,
        severity,
        ipAddress: req ? getClientIp(req) : undefined,
        userAgent: req ? getUserAgent(req) : undefined,
        metadata,
      },
    });
  }

  async event(
    userId: string | null,
    type: string,
    severity: Severity,
    req?: HttpRequestContext,
    metadata?: Prisma.InputJsonValue
  ): Promise<void> {
    await this.db.securityEvent.create({
      data: {
        userId,
        type,
        severity,
        ipAddress: req ? getClientIp(req) : undefined,
        userAgent: req ? getUserAgent(req) : undefined,
        metadata,
      },
    });
  }
}
