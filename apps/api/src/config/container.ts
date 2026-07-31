import { JwtService } from '@secureauthx/security';
import { PasswordService } from '@secureauthx/auth';
import { UserRepository } from '@secureauthx/database';
import type { PrismaClient } from '@secureauthx/database';
import type Redis from 'ioredis';
import { env } from './env';

export interface Container {
  prisma: PrismaClient;
  redis: Redis;
  jwt: JwtService;
  password: PasswordService;
  repositories: {
    users: UserRepository;
  };
}

/**
 * Composes the application's service graph.
 * All services are constructed here; controllers depend on the container
 * (never on `process.env` or globals) for testability.
 */
export function buildContainer(prisma: PrismaClient, redisClient: Redis): Container {
  return {
    prisma,
    redis: redisClient,
    jwt: new JwtService({
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    }),
    password: new PasswordService(env.BCRYPT_ROUNDS),
    repositories: {
      users: new UserRepository(prisma),
    },
  };
}

export type AppContainer = ReturnType<typeof buildContainer>;
