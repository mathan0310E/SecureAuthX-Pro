import { JwtService, AtRestCipher } from '@secureauthx/security';
import { PasswordService } from '@secureauthx/auth';
import { MailService } from '@secureauthx/mail';
import {
  AuditRepository,
  EmailVerificationRepository,
  MfaRepository,
  SecurityRepository,
  SessionRepository,
  UserRepository,
} from '@secureauthx/database';
import type { PrismaClient } from '@secureauthx/database';
import type { Cache } from './cache';
import { env } from './env';
import { createChildLogger } from './logger';
import { AuthService } from '../services/auth.service';
import { MfaService } from '../services/mfa.service';
import { SecurityService } from '../services/security.service';
import { AdminService } from '../services/admin.service';

export interface Container {
  prisma: PrismaClient;
  cache: Cache;
  jwt: JwtService;
  password: PasswordService;
  mail: MailService;
  auth: AuthService;
  mfa: MfaService;
  security: SecurityService;
  admin: AdminService;
  repositories: {
    users: UserRepository;
    sessions: SessionRepository;
    emailVerifications: EmailVerificationRepository;
    audits: AuditRepository;
    mfa: MfaRepository;
    security: SecurityRepository;
  };
}

/**
 * Composes the application's service graph.
 * All services are constructed here; controllers depend on the container
 * (never on `process.env` or globals) for testability.
 */
export function buildContainer(prisma: PrismaClient, cache: Cache): Container {
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
    from: env.SMTP_FROM,
    appName: env.APP_NAME,
    webUrl: env.WEB_URL,
    provider: env.MAIL_PROVIDER,
    resendApiKey: env.RESEND_API_KEY || undefined,
    smtp:
      env.MAIL_PROVIDER === 'smtp'
        ? {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            user: env.SMTP_USER,
            password: env.SMTP_PASSWORD,
          }
        : undefined,
    logger: createChildLogger('mail'),
  });

  const repositories = {
    users: new UserRepository(prisma),
    sessions: new SessionRepository(prisma),
    emailVerifications: new EmailVerificationRepository(prisma),
    audits: new AuditRepository(prisma),
    mfa: new MfaRepository(prisma),
    security: new SecurityRepository(prisma),
  };

  const cipher = new AtRestCipher({ key: AtRestCipher.deriveKey(env.ENCRYPTION_KEY) });

  const mfa = new MfaService({
    prisma,
    cache,
    password,
    users: repositories.users,
    mfa: repositories.mfa,
    audits: repositories.audits,
    cipher,
  });

  const auth = new AuthService({
    prisma,
    jwt,
    password,
    mail,
    users: repositories.users,
    sessions: repositories.sessions,
    emailVerifications: repositories.emailVerifications,
    audits: repositories.audits,
    mfa,
  });

  const security = new SecurityService({
    security: repositories.security,
  });

  const admin = new AdminService({
    prisma,
    users: repositories.users,
    sessions: repositories.sessions,
    audits: repositories.audits,
    security: repositories.security,
  });

  return {
    prisma,
    cache,
    jwt,
    password,
    mail,
    auth,
    mfa,
    security,
    admin,
    repositories,
  };
}

export type AppContainer = ReturnType<typeof buildContainer>;
