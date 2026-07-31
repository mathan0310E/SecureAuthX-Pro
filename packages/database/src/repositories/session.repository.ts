import type { PrismaClient } from '@prisma/client';

export interface CreateSessionInput {
  id?: string;
  userId: string;
  refreshTokenHash: string;
  ipAddress: string;
  userAgent: string;
  deviceName: string;
  deviceFingerprint?: string;
  expiresAt: Date;
}

/**
 * Session persistence. Sessions are bound to a single refresh token via
 * its SHA-256 hash, enabling token reuse detection and rotation.
 */
export class SessionRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateSessionInput) {
    return this.db.session.create({ data: input });
  }

  findActiveById(id: string) {
    return this.db.session.findFirst({
      where: { id, status: 'ACTIVE' },
      include: { user: true },
    });
  }

  async rotateToken(id: string, refreshTokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.session.update({
      where: { id },
      data: { refreshTokenHash, expiresAt, lastActiveAt: new Date() },
    });
  }

  async markExpired(id: string): Promise<void> {
    await this.db.session.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.db.session.update({
      where: { id },
      data: { status: 'REVOKED' },
    });
  }

  async revokeAllForUser(userId: string, exceptId?: string): Promise<void> {
    await this.db.session.updateMany({
      where: { userId, status: 'ACTIVE', ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      data: { status: 'REVOKED' },
    });
  }
}
