import type {
  AuditLogEntry,
  AuditLogListResponse,
  SecurityEventEntry,
  SecurityEventListResponse,
} from '@secureauthx/types';
import type { Severity } from '@prisma/client';
import type { SecurityRepository } from '@secureauthx/database';
import { resolvePagination } from '@secureauthx/shared';

interface SecurityServiceDeps {
  security: SecurityRepository;
}

function toAuditEntry(row: {
  id: string;
  action: string;
  severity: Severity;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
}): AuditLogEntry {
  return {
    id: row.id,
    action: row.action,
    severity: row.severity,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toEventEntry(row: {
  id: string;
  type: string;
  severity: Severity;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
}): SecurityEventEntry {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Read-side security telemetry: the per-user activity feed behind the
 * Security Dashboard. Users only ever see their own records.
 */
export class SecurityService {
  constructor(private readonly deps: SecurityServiceDeps) {}

  async listMyAuditLogs(
    userId: string,
    query: { page?: number; pageSize?: number; severity?: string; action?: string }
  ): Promise<AuditLogListResponse> {
    const { page, pageSize, skip, take } = resolvePagination(query);
    const { items, total } = await this.deps.security.listAuditLogs({
      userId,
      skip,
      take,
      severity: (query.severity as Severity | undefined) ?? undefined,
      action: query.action,
    });
    return { items: items.map(toAuditEntry), total, page, pageSize };
  }

  async listMySecurityEvents(
    userId: string,
    query: { page?: number; pageSize?: number; severity?: string; type?: string }
  ): Promise<SecurityEventListResponse> {
    const { page, pageSize, skip, take } = resolvePagination(query);
    const { items, total } = await this.deps.security.listSecurityEvents({
      userId,
      skip,
      take,
      severity: (query.severity as Severity | undefined) ?? undefined,
      action: query.type,
    });
    return { items: items.map(toEventEntry), total, page, pageSize };
  }
}
