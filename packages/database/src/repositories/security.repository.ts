import type { Prisma, PrismaClient, Severity } from '@prisma/client';

export interface SecurityListParams {
  /** Scope to a single user's records (null = all users / admins). */
  userId?: string | null;
  skip: number;
  take: number;
  severity?: Severity;
  /** Filter by action prefix or exact action. */
  action?: string;
  /** Only records at or after this time. */
  from?: Date;
}

/**
 * Read-path repository for the security telemetry surfaces: the user-facing
 * activity feed (audit logs + security events) and the admin analytics.
 * Writes happen through {@link AuditRepository}.
 */
export class SecurityRepository {
  constructor(private readonly db: PrismaClient) {}

  // -------------------------------------------------------------------------
  // Audit logs
  // -------------------------------------------------------------------------

  async listAuditLogs(params: SecurityListParams): Promise<{
    items: Prisma.AuditLogGetPayload<Record<string, never>>[];
    total: number;
  }> {
    const where: Prisma.AuditLogWhereInput = this.buildWhere(params);

    const [items, total] = await this.db.$transaction([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.db.auditLog.count({ where }),
    ]);

    return { items, total };
  }

  // -------------------------------------------------------------------------
  // Security events
  // -------------------------------------------------------------------------

  async listSecurityEvents(params: SecurityListParams): Promise<{
    items: Prisma.SecurityEventGetPayload<Record<string, never>>[];
    total: number;
  }> {
    const where: Prisma.SecurityEventWhereInput = this.buildWhere(params);

    const [items, total] = await this.db.$transaction([
      this.db.securityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.db.securityEvent.count({ where }),
    ]);

    return { items, total };
  }

  // -------------------------------------------------------------------------
  // Analytics aggregates
  // -------------------------------------------------------------------------

  async countUsersByStatus(): Promise<Record<string, number>> {
    const rows = await this.db.user.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  }

  async countMfaEnabled(): Promise<number> {
    return this.db.user.count({ where: { mfaEnabled: true } });
  }

  async countActiveSessions(): Promise<number> {
    return this.db.session.count({ where: { status: 'ACTIVE', expiresAt: { gt: new Date() } } });
  }

  /** Counts records created after `from` for the given model. */
  async countAuditSince(from: Date): Promise<number> {
    return this.db.auditLog.count({ where: { createdAt: { gte: from } } });
  }

  /** Counts records created after `from` for the given model. */
  async countEventsSince(from: Date): Promise<number> {
    return this.db.securityEvent.count({ where: { createdAt: { gte: from } } });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private buildWhere(
    params: SecurityListParams
  ): Prisma.AuditLogWhereInput & Prisma.SecurityEventWhereInput {
    const where: Prisma.AuditLogWhereInput & Prisma.SecurityEventWhereInput = {};
    if (params.userId) where.userId = params.userId;
    if (params.severity) where.severity = params.severity;
    if (params.from) where.createdAt = { gte: params.from };
    if (params.action) {
      where.action = params.action.endsWith('.')
        ? { startsWith: params.action }
        : params.action;
    }
    return where;
  }
}
