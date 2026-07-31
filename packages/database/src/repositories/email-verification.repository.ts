import type { PrismaClient } from '@prisma/client';

/**
 * Email verification token persistence. Only the SHA-256 hash of the
 * opaque token is stored, so a database leak never exposes usable tokens.
 */
export class EmailVerificationRepository {
  constructor(private readonly db: PrismaClient) {}

  create(userId: string, tokenHash: string, expiresAt: Date) {
    return this.db.emailVerification.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  findActiveByHash(tokenHash: string) {
    return this.db.emailVerification.findFirst({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async markUsed(id: string): Promise<void> {
    await this.db.emailVerification.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  /** Invalidates all pending tokens for a user (e.g. on resend). */
  async revokePending(userId: string): Promise<void> {
    await this.db.emailVerification.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
