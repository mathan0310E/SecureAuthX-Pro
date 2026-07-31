import { JwtService } from '@secureauthx/security';
import { PasswordService } from '@secureauthx/auth';
import { MailService } from '@secureauthx/mail';
import {
  AuditRepository,
  EmailVerificationRepository,
  SessionRepository,
  UserRepository,
} from '@secureauthx/database';
import type { PrismaClient } from '@secureauthx/database';
import type Redis from 'ioredis';
import { env } from './env';
import { createChildLogger } from './logger';
import { AuthService } from '../services/auth.service';

export interface Container {
  prisma: PrismaClient;
  redis: Redis;
  jwt: JwtService;
  password: PasswordService;
  mail: MailService;
  auth: AuthService;
  repositories: {
    users: UserRepository;
    sessions: SessionRepository;
    emailVerifications: EmailVerificationRepository;
    audits: AuditRepository;
  };
}

/**
 * Composes the application's service graph.
 * All services are constructed here; controllers depend on the container
 * (never on `process.env` or globals) for testability.
 */
export function buildContainer(prisma: PrismaClient, redisClient: Redis): Container {
  const jwt = new JwtService({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
  });

  const password = new PasswordService(env.BCRYPT_ROUNDS);

  const mail = new MailService({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
    appName: env.APP_NAME,
    webUrl: env.WEB_URL,
    logger: createChildLogger('mail'),
  });

  const repositories = {
    users: new UserRepository(prisma),
    sessions: new SessionRepository(prisma),
    emailVerifications: new EmailVerificationRepository(prisma),
    audits: new AuditRepository(prisma),
  };

  const auth = new AuthService({
    prisma,
    jwt,
    password,
    mail,
    users: repositories.users,
    sessions: repositories.sessions,
    emailVerifications: repositories.emailVerifications,
    audits: repositories.audits,
  });

  return {
    prisma,
    redis: redisClient,
    jwt,
    password,
    mail,
    auth,
    repositories,
  };
}

export type AppContainer = ReturnType<typeof buildContainer>;
