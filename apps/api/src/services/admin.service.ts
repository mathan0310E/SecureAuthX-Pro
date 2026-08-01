import type {
  AdminUserRow,
  AdminUsersListResponse,
  AnalyticsOverview,
  AnalyticsTrendPoint,
  AnalyticsTrendsResponse,
} from '@secureauthx/types';
import type { AccountStatus, UserRole } from '@secureauthx/types';
import { Prisma } from '@secureauthx/database';
import type { PrismaClient } from '@secureauthx/database';
import type { UserRepository, SessionRepository, AuditRepository, SecurityRepository } from '@secureauthx/database';
import { resolvePagination, buildPaginationMeta, type HttpRequestContext } from '@secureauthx/shared';
import { AUDIT_ACTION } from '@secureauthx/config';
import { Errors } from '../utils/errors';

interface AdminServiceDeps {
  prisma: PrismaClient;
  users: UserRepository;
  sessions: SessionRepository;
  audits: AuditRepository;
  security: SecurityRepository;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['LOCKED', 'DISABLED', 'PENDING_VERIFICATION'],
  LOCKED: ['ACTIVE', 'DISABLED'],
  DISABLED: ['ACTIVE'],
  PENDING_VERIFICATION: ['ACTIVE', 'DISABLED'],
};

/**
 * Administrator operations: user lifecycle management and the analytics
 * behind the admin dashboard. Every mutation is audited with the actor id.
 */
export class AdminService {
  constructor(private readonly deps: AdminServiceDeps) {}

  // -------------------------------------------------------------------------
  // User management
  // -------------------------------------------------------------------------

  async listUsers(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }): Promise<AdminUsersListResponse> {
    const { page, pageSize, skip, take } = resolvePagination(query);
    const search = query.search?.trim() || undefined;
    const status = query.status as AccountStatus | undefined;

    const [rows, total] = await Promise.all([
      this.deps.users.list({ skip, take, search, status }),
      this.deps.users.countList({ search, status }),
    ]);

    const items: AdminUserRow[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      emailVerified: row.emailVerified,
      mfaEnabled: row.mfaEnabled,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async setUserRole(
    actorId: string,
    userId: string,
    role: UserRole,
    req: HttpRequestContext
  ): Promise<{ id: string; email: string; role: UserRole }> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw Errors.notFound('User not found.');

    if (user.id === actorId && role !== user.role) {
      // Prevent an admin from demoting the last admin via a self-demotion
      // is handled generically below; also guard self role changes.
      throw Errors.forbidden('You cannot change your own role.');
    }

    const updated = await this.deps.users.setRole(userId, role);
    await this.deps.audits.log(actorId, AUDIT_ACTION.ADMIN_USER_ROLE_CHANGED, 'INFO', req, {
      targetUserId: userId,
      previousRole: user.role,
      newRole: role,
    });

    return { id: updated.id, email: updated.email, role: updated.role };
  }

  async setUserStatus(
    actorId: string,
    userId: string,
    status: AccountStatus,
    req: HttpRequestContext
  ): Promise<{ id: string; email: string; status: AccountStatus }> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw Errors.notFound('User not found.');

    if (user.id === actorId && status === 'DISABLED') {
      throw Errors.forbidden('You cannot disable your own account.');
    }

    const allowed = ALLOWED_TRANSITIONS[user.status] ?? [];
    if (status !== user.status && !allowed.includes(status)) {
      throw Errors.badRequest(
        `Cannot transition user from ${user.status} to ${status}.`
      );
    }

    // Admin locks are permanent (until explicitly unlocked). A far-future
    // `lockedUntil` makes `isLocked` block login without expiring on its own,
    // unlike the transient auto-lock that follows failed login attempts.
    const updated =
      status === 'LOCKED'
        ? await this.deps.users.update(userId, {
            status,
            lockedUntil: new Date('2999-12-31T23:59:59Z'),
          })
        : await this.deps.users.update(userId, {
            status,
            lockedUntil: null,
          });

    // Deactivating or locking a user invalidates their active sessions.
    if (status === 'DISABLED' || status === 'LOCKED') {
      await this.deps.sessions.revokeAllForUser(userId);
    }

    const action =
      status === 'DISABLED'
        ? AUDIT_ACTION.ADMIN_USER_DEACTIVATED
        : status === 'ACTIVE'
          ? AUDIT_ACTION.ADMIN_USER_ACTIVATED
          : AUDIT_ACTION.ADMIN_USER_ROLE_CHANGED;

    await this.deps.audits.log(actorId, action, status === 'DISABLED' ? 'WARN' : 'INFO', req, {
      targetUserId: userId,
      previousStatus: user.status,
      newStatus: status,
    });

    return { id: updated.id, email: updated.email, status: updated.status };
  }

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  async analyticsOverview(): Promise<AnalyticsOverview> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const byStatus = await this.deps.security.countUsersByStatus();
    const total = await this.deps.users.countActive();
    const allTotal =
      (byStatus.ACTIVE ?? 0) +
      (byStatus.LOCKED ?? 0) +
      (byStatus.DISABLED ?? 0) +
      (byStatus.PENDING_VERIFICATION ?? 0);

    const mfaEnabled = await this.deps.security.countMfaEnabled();
    const activeSessions = await this.deps.security.countActiveSessions();

    const [audit24, audit7, events24, events7] = await Promise.all([
      this.deps.security.countAuditSince(dayAgo),
      this.deps.security.countAuditSince(weekAgo),
      this.deps.security.countEventsSince(dayAgo),
      this.deps.security.countEventsSince(weekAgo),
    ]);

    return {
      users: {
        total: allTotal,
        active: byStatus.ACTIVE ?? 0,
        locked: byStatus.LOCKED ?? 0,
        disabled: byStatus.DISABLED ?? 0,
        pendingVerification: byStatus.PENDING_VERIFICATION ?? 0,
        mfaEnabled,
        mfaAdoptionRate: allTotal === 0 ? 0 : Math.round((mfaEnabled / allTotal) * 1000) / 10,
      },
      sessions: { active: activeSessions },
      activity: {
        auditLogs24h: audit24,
        auditLogs7d: audit7,
        securityEvents24h: events24,
        securityEvents7d: events7,
      },
      generatedAt: now.toISOString(),
    };
  }

  async analyticsTrends(days: number): Promise<AnalyticsTrendsResponse> {
    const clamp = Math.max(1, Math.min(90, days));
    const from = new Date(Date.now() - (clamp - 1) * 24 * 3600 * 1000);
    from.setHours(0, 0, 0, 0);

    const [signups, logins, mfaLogins, securityEvents] = await Promise.all([
      this.countByDay('user', from),
      this.countByDay('audit', from, { action: 'auth.login_success' }),
      this.countByDay('audit', from, { action: 'mfa.login_verified' }),
      this.countByDay('event', from),
    ]);

    const points: AnalyticsTrendPoint[] = [];
    for (let i = 0; i < clamp; i += 1) {
      const date = new Date(from.getTime() + i * 24 * 3600 * 1000);
      const key = date.toISOString().slice(0, 10);
      points.push({
        date: key,
        signups: signups.get(key) ?? 0,
        logins: logins.get(key) ?? 0,
        mfaLogins: mfaLogins.get(key) ?? 0,
        securityEvents: securityEvents.get(key) ?? 0,
      });
    }

    return { points, days: clamp };
  }

  /** Buckets records into per-day counts keyed by `yyyy-mm-dd`. */
  private async countByDay(
    source: 'user' | 'audit' | 'event',
    from: Date,
    filter?: { action: string }
  ): Promise<Map<string, number>> {
    type Row = { day: Date; count: bigint };
    const rows = await this.deps.prisma.$queryRaw<Row[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
      FROM ${this.sourceTable(source)}
      WHERE "createdAt" >= ${from}
      ${filter ? Prisma.sql`AND "action" = ${filter.action}` : Prisma.sql``}
      GROUP BY 1
      ORDER BY 1
    `;

    const map = new Map<string, number>();
    for (const row of rows) {
      const key = new Date(row.day).toISOString().slice(0, 10);
      map.set(key, Number(row.count));
    }
    return map;
  }

  private sourceTable(source: 'user' | 'audit' | 'event') {
    switch (source) {
      case 'user':
        return Prisma.sql`"users"`;
      case 'audit':
        return Prisma.sql`"audit_logs"`;
      case 'event':
        return Prisma.sql`"security_events"`;
    }
  }
}
