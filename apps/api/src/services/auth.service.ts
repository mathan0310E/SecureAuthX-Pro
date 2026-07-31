import type { Request } from 'express';
import {
  computeDeviceFingerprint,
  describeDevice,
  generateCsrfToken,
  generateSecureToken,
  generateUuid,
  getClientIp,
  getUserAgent,
  safeEqual,
  sha256,
} from '@secureauthx/shared';
import { AUDIT_ACTION, COOKIE_NAMES, SECURITY_EVENT_TYPE } from '@secureauthx/config';
import { resolveAccessToken } from '../middlewares/authenticate';
import type { AuthTokens, AuthUser, LoginResponseData, MfaLoginResponseData, RefreshResponseData, RegisterResponseData, ResendVerificationResponseData, VerifyEmailResponseData } from '@secureauthx/types';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import type { JwtService } from '@secureauthx/security';
import type { PasswordService } from '@secureauthx/auth';
import type { MailService } from '@secureauthx/mail';
import type {
  AuditRepository,
  EmailVerificationRepository,
  PrismaClient,
  SessionRepository,
  UserRepository,
} from '@secureauthx/database';
import { AppError, Errors } from '../utils/errors';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { MfaService } from './mfa.service';

interface AuthServiceDeps {
  prisma: PrismaClient;
  jwt: JwtService;
  password: PasswordService;
  mail: MailService;
  users: UserRepository;
  sessions: SessionRepository;
  emailVerifications: EmailVerificationRepository;
  audits: AuditRepository;
  mfa: MfaService;
}

type UserLike = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'PENDING_VERIFICATION';
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  passwordHash: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
};

function toAuthUser(user: UserLike): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

/** Result of a completed second-factor challenge: tokens + optional trusted-device cookie value. */
export interface MfaLoginCompletion {
  user: AuthUser;
  tokens: AuthTokens;
  deviceToken: string | null;
}

/**
 * Orchestrates the authentication lifecycle: registration, login, email
 * verification, refresh-token rotation, and session management.
 */
export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  async register(
    input: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
    },
    req: Request
  ): Promise<RegisterResponseData> {
    const { email, password, firstName, lastName, displayName } = input;

    const existing = await this.deps.users.findByEmail(email);
    if (existing) {
      if (!existing.emailVerified) {
        // Friendly recovery: someone re-registering a lost unverified account
        // gets a fresh verification email.
        await this.issueVerificationToken(existing.id, existing.email, req, 'resent');
      }
      await this.deps.audits.log(existing.id, AUDIT_ACTION.REGISTER, 'INFO', req, {
        email,
        reason: 'already_exists',
      });
      return { email, requiresEmailVerification: true };
    }

    const passwordHash = await this.deps.password.hash(password);
    const user = await this.deps.users.create({
      email,
      passwordHash,
      status: 'PENDING_VERIFICATION',
      role: 'USER',
      ...(firstName || lastName || displayName
        ? {
            profile: {
              create: {
                firstName: firstName ?? null,
                lastName: lastName ?? null,
                displayName: displayName ?? (firstName && lastName ? `${firstName} ${lastName}` : null),
              },
            },
          }
        : {}),
    });

    await this.deps.audits.log(user.id, AUDIT_ACTION.REGISTER, 'INFO', req);
    await this.issueVerificationToken(user.id, user.email, req, 'sent');

    return { email: user.email, requiresEmailVerification: true };
  }

  private async issueVerificationToken(
    userId: string,
    email: string,
    req: Request,
    mode: 'sent' | 'resent'
  ): Promise<void> {
    await this.deps.emailVerifications.revokePending(userId);

    const rawToken = generateSecureToken(32);
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TTL * 1000);

    await this.deps.emailVerifications.create(userId, tokenHash, expiresAt);
    const link = await this.deps.mail.sendVerificationEmail(email, rawToken);

    if (env.NODE_ENV === 'development') {
      logger.info(`[dev] verification link for ${email}: ${link}`);
    }

    await this.deps.audits.log(
      userId,
      mode === 'resent' ? AUDIT_ACTION.EMAIL_VERIFICATION_RESENT : AUDIT_ACTION.EMAIL_VERIFICATION_SENT,
      'INFO',
      req
    );
  }

  // ---------------------------------------------------------------------------
  // Email verification
  // ---------------------------------------------------------------------------

  async verifyEmail(token: string, req: Request): Promise<VerifyEmailResponseData> {
    const record = await this.deps.emailVerifications.findActiveByHash(sha256(token));
    if (!record) {
      throw Errors.badRequest('Verification token is invalid or has expired.');
    }

    const user = record.user;
    if (user.emailVerified) {
      // Idempotent: an already-verified account confirms instantly.
      await this.deps.emailVerifications.markUsed(record.id);
      return { email: user.email, verified: true };
    }

    if (record.usedAt || record.expiresAt < new Date()) {
      throw Errors.badRequest('Verification token is invalid or has expired.');
    }

    await this.deps.emailVerifications.markUsed(record.id);
    await this.deps.users.markEmailVerified(user.id);
    await this.deps.audits.log(user.id, AUDIT_ACTION.EMAIL_VERIFIED, 'INFO', req);

    return { email: user.email, verified: true };
  }

  async resendVerification(email: string, req: Request): Promise<ResendVerificationResponseData> {
    const user = await this.deps.users.findByEmail(email);
    if (user && !user.emailVerified) {
      await this.issueVerificationToken(user.id, user.email, req, 'resent');
    }
    // Uniform response prevents account enumeration.
    return { email, sent: true };
  }

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  async login(
    input: { email: string; password: string; rememberMe?: boolean },
    req: Request
  ): Promise<LoginResponseData | MfaLoginResponseData> {
    const { email, password, rememberMe = false } = input;
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    const user = await this.deps.users.findByEmail(email);
    if (!user) {
      // Equalize timing so user enumeration is not possible via latency.
      await this.deps.password.verifyDummy();
      await this.deps.audits.log(null, AUDIT_ACTION.LOGIN_FAILED, 'WARN', req, {
        email,
        reason: 'unknown_user',
      });
      throw Errors.unauthorized('Invalid email or password.');
    }

    if (user.status === 'DISABLED') {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account has been disabled. Contact an administrator.');
    }

    if (user.status === 'LOCKED') {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
        );
        await this.deps.audits.log(user.id, AUDIT_ACTION.LOGIN_FAILED, 'WARN', req, {
          reason: 'account_locked',
        });
        throw new AppError(
          423,
          'ACCOUNT_LOCKED',
          'Account is temporarily locked due to too many failed attempts.',
          { details: { retryAfterSeconds } }
        );
      }
      // Lock window elapsed — unlock transparently.
      await this.deps.users.unlock(user.id);
    }

    if (!user.emailVerified || user.status === 'PENDING_VERIFICATION') {
      await this.deps.audits.log(user.id, AUDIT_ACTION.LOGIN_FAILED, 'WARN', req, {
        reason: 'email_not_verified',
      });
      throw new AppError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Your email address has not been verified yet. Check your inbox for the verification link.'
      );
    }

    const valid = await this.deps.password.verify(password, user.passwordHash ?? '');
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= env.LOGIN_MAX_ATTEMPTS;
      const lockedUntil = shouldLock ? new Date(Date.now() + env.LOGIN_LOCKOUT_MINUTES * 60000) : null;

      await this.deps.users.recordFailedLogin(user.id, attempts, lockedUntil);
      await this.deps.audits.log(user.id, AUDIT_ACTION.LOGIN_FAILED, 'WARN', req, {
        attempts,
        willLock: shouldLock,
      });

      if (shouldLock) {
        await this.deps.audits.log(user.id, AUDIT_ACTION.LOGIN_LOCKED, 'CRITICAL', req);
        await this.deps.audits.event(
          user.id,
          SECURITY_EVENT_TYPE.ACCOUNT_LOCKED,
          'CRITICAL',
          req,
          { attempts }
        );
      }

      throw Errors.unauthorized('Invalid email or password.');
    }

    await this.deps.users.markLoginSuccess(user.id, ip);

    if (user.mfaEnabled) {
      const trusted = await this.deps.mfa.isDeviceTrusted(user.id, req);
      if (trusted) {
        const tokens = await this.issueTokens(user, { ip, userAgent }, rememberMe);
        await this.deps.audits.log(user.id, AUDIT_ACTION.LOGIN_SUCCESS, 'INFO', req, { rememberMe });
        return { user: toAuthUser(user), tokens };
      }

      const challenge = await this.deps.mfa.issueLoginChallenge(user.id, rememberMe);
      await this.deps.audits.log(user.id, AUDIT_ACTION.MFA_CHALLENGE_ISSUED, 'INFO', req, {
        method: challenge.method,
      });
      return { challenge };
    }

    const tokens = await this.issueTokens(user, { ip, userAgent }, rememberMe);

    await this.deps.audits.log(user.id, AUDIT_ACTION.LOGIN_SUCCESS, 'INFO', req, { rememberMe });

    return { user: toAuthUser(user), tokens };
  }

  // ---------------------------------------------------------------------------
  // MFA login completion
  // ---------------------------------------------------------------------------

  /** Completes a TOTP-challenged login and issues the session tokens. */
  async completeMfaTotp(
    input: { challengeId: string; code: string; rememberDevice: boolean },
    req: Request
  ): Promise<MfaLoginCompletion> {
    const { userId, deviceToken } = await this.deps.mfa.verifyTotpLogin(
      input.challengeId,
      input.code,
      input.rememberDevice,
      req
    );
    return this.finishMfaLogin(userId, req, deviceToken);
  }

  /** Completes a recovery-code-challenged login. */
  async completeMfaRecovery(
    input: { challengeId: string; code: string },
    req: Request
  ): Promise<MfaLoginCompletion> {
    const userId = await this.deps.mfa.verifyRecoveryLogin(input.challengeId, input.code, req);
    return this.finishMfaLogin(userId, req, null);
  }

  /** Starts the WebAuthn assertion ceremony for a pending challenge. */
  async beginWebAuthnMfaLogin(
    challengeId: string
  ): Promise<{ options: PublicKeyCredentialRequestOptionsJSON }> {
    return this.deps.mfa.beginWebAuthnLogin(challengeId);
  }

  /** Completes a WebAuthn-challenged login and issues the session tokens. */
  async completeWebAuthnMfa(
    input: {
      challengeId: string;
      credential: Parameters<MfaService['verifyWebAuthnLogin']>[1];
      rememberDevice: boolean;
    },
    req: Request
  ): Promise<MfaLoginCompletion> {
    const { userId, deviceToken } = await this.deps.mfa.verifyWebAuthnLogin(
      input.challengeId,
      input.credential,
      input.rememberDevice,
      req
    );
    return this.finishMfaLogin(userId, req, deviceToken);
  }

  private async finishMfaLogin(
    userId: string,
    req: Request,
    deviceToken: string | null
  ): Promise<MfaLoginCompletion> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw Errors.unauthorized('Account no longer exists.');

    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const tokens = await this.issueTokens(user, { ip, userAgent }, false);

    await this.deps.audits.log(user.id, AUDIT_ACTION.MFA_LOGIN_VERIFIED, 'INFO', req, {
      rememberDevice: deviceToken !== null,
    });

    return {
      user: toAuthUser(user),
      tokens,
      deviceToken,
    };
  }

  // ---------------------------------------------------------------------------
  // Token issuance & refresh
  // ---------------------------------------------------------------------------

  private async issueTokens(
    user: UserLike,
    device: { ip: string; userAgent: string },
    rememberMe: boolean
  ): Promise<AuthTokens> {
    // remember-me extends the session to the refresh-token lifetime;
    // otherwise it follows the absolute session timeout.
    const refreshTtl = rememberMe ? env.JWT_REFRESH_TTL : env.SESSION_TIMEOUT_MINUTES * 60;

    const sessionId = generateUuid();
    const accessToken = this.deps.jwt.createAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    });
    const refreshToken = this.deps.jwt.createRefreshToken(user.id, sessionId, refreshTtl);
    const csrfToken = generateCsrfToken();

    await this.deps.sessions.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: sha256(refreshToken),
      ipAddress: device.ip,
      userAgent: device.userAgent,
      deviceName: describeDevice(device.userAgent),
      deviceFingerprint: computeDeviceFingerprint({
        userAgent: device.userAgent,
        ipAddress: device.ip,
      }),
      expiresAt: new Date(Date.now() + refreshTtl * 1000),
    });

    return {
      accessToken,
      refreshToken,
      csrfToken,
      expiresIn: refreshTtl,
      tokenType: 'Bearer',
    };
  }

  async refresh(refreshToken: string, req: Request): Promise<RefreshResponseData> {
    const payload = this.deps.jwt.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw Errors.unauthorized('Invalid or expired refresh token.');
    }

    const session = await this.deps.sessions.findActiveById(payload.jti);
    if (!session) {
      throw Errors.unauthorized('Session is no longer active.');
    }

    const user = session.user;
    const suppliedHash = sha256(refreshToken);

    if (!safeEqual(session.refreshTokenHash, suppliedHash)) {
      // The same session id was presented with a different token — reuse.
      await this.deps.sessions.revoke(session.id);
      await this.deps.audits.event(user.id, SECURITY_EVENT_TYPE.REFRESH_TOKEN_REUSE, 'CRITICAL', req);
      await this.deps.audits.log(user.id, AUDIT_ACTION.TOKEN_REUSE_DETECTED, 'CRITICAL', req);
      throw Errors.unauthorized('Session has been revoked due to a security event.');
    }

    if (session.expiresAt < new Date()) {
      await this.deps.sessions.markExpired(session.id);
      await this.deps.audits.log(user.id, AUDIT_ACTION.SESSION_EXPIRED, 'WARN', req);
      throw Errors.unauthorized('Session has expired. Please sign in again.');
    }

    if (user.status === 'DISABLED') {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account has been disabled. Contact an administrator.');
    }

    const remainingTtl = Math.max(1, Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000));
    const newRefreshToken = this.deps.jwt.createRefreshToken(user.id, session.id, remainingTtl);
    const accessToken = this.deps.jwt.createAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });
    const csrfToken = generateCsrfToken();

    await this.deps.sessions.rotateToken(session.id, sha256(newRefreshToken), session.expiresAt);
    await this.deps.audits.log(user.id, AUDIT_ACTION.REFRESH_TOKEN_ROTATED, 'INFO', req);

    return {
      user: toAuthUser(user),
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
        csrfToken,
        expiresIn: remainingTtl,
        tokenType: 'Bearer',
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  /**
   * Revokes the current session. Resolution order prefers the refresh
   * cookie (works even when the access token has expired) and falls back
   * to the access token. Idempotent — always succeeds for the caller.
   */
  async logout(req: Request): Promise<{ revoked: boolean; userId: string | null }> {
    const accessToken = resolveAccessToken(req);
    const refreshToken =
      typeof req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] === 'string'
        ? req.cookies[COOKIE_NAMES.REFRESH_TOKEN]
        : undefined;

    let sessionId: string | null = null;
    let userId: string | null = null;

    if (refreshToken) {
      const payload = this.deps.jwt.verifyRefreshToken(refreshToken);
      sessionId = payload?.jti ?? null;
      userId = payload?.sub ?? null;
    }
    if (!sessionId && accessToken) {
      const payload = this.deps.jwt.verifyAccessToken(accessToken);
      sessionId = payload?.sessionId ?? null;
      userId = payload?.sub ?? null;
    }

    if (sessionId) {
      await this.deps.sessions.revoke(sessionId);
      if (userId) {
        await this.deps.audits.log(userId, AUDIT_ACTION.LOGOUT, 'INFO', req);
      }
    }

    return { revoked: sessionId !== null, userId };
  }
}
