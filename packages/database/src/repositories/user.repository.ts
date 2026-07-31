import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * User repository — the single source of truth for user persistence.
 * Kept transport-agnostic so the auth layer can build on it.
 */
export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmailWithProfile(email: string) {
    return this.db.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  findByIdWithProfile(id: string) {
    return this.db.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  create(data: Prisma.UserCreateInput) {
    return this.db.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.db.user.update({ where: { id }, data });
  }

  updatePassword(id: string, passwordHash: string) {
    return this.db.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  markEmailVerified(id: string) {
    return this.db.user.update({
      where: { id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
      },
    });
  }

  markLoginSuccess(id: string, ip: string) {
    return this.db.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  recordFailedLogin(id: string, failedAttempts: number, lockUntil: Date | null) {
    return this.db.user.update({
      where: { id },
      data: {
        failedLoginAttempts: failedAttempts,
        lockedUntil: lockUntil,
        status: lockUntil ? 'LOCKED' : undefined,
      },
    });
  }

  isLocked(user: { lockedUntil: Date | null; status: string }): boolean {
    if (user.status === 'DISABLED') return true;
    if (user.status === 'LOCKED') {
      if (user.lockedUntil && user.lockedUntil > new Date()) return true;
    }
    return false;
  }

  unlock(id: string) {
    return this.db.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        lockedUntil: null,
        failedLoginAttempts: 0,
      },
    });
  }

  setStatus(id: string, status: 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'PENDING_VERIFICATION') {
    return this.db.user.update({ where: { id }, data: { status } });
  }

  setRole(id: string, role: 'USER' | 'ADMIN') {
    return this.db.user.update({ where: { id }, data: { role } });
  }

  async countActive(): Promise<number> {
    return this.db.user.count({ where: { status: 'ACTIVE' } });
  }

  list(params: { skip: number; take: number; search?: string; status?: string }) {
    const where: Prisma.UserWhereInput = {
      ...(params.search
        ? { email: { contains: params.search, mode: 'insensitive' } }
        : {}),
      ...(params.status ? { status: params.status as never } : {}),
    };

    return this.db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
  }

  async countList(params: { search?: string; status?: string }): Promise<number> {
    const where: Prisma.UserWhereInput = {
      ...(params.search
        ? { email: { contains: params.search, mode: 'insensitive' } }
        : {}),
      ...(params.status ? { status: params.status as never } : {}),
    };
    return this.db.user.count({ where });
  }
}
