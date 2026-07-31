import type { Request } from 'express';
import { randomBytes } from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  MfaMethod,
  MfaStatus,
  RegistrationResponseJSON,
  WebAuthnCredentialInfo,
} from '@secureauthx/types';
import { AtRestCipher, buildOtpauthUrl, generateTotpSecret, verifyTotp } from '@secureauthx/security';
import type { PasswordService } from '@secureauthx/auth';
import {
  AUDIT_ACTION,
  COOKIE_NAMES,
  MFA as MFA_CONFIG,
} from '@secureauthx/config';
import {
  describeDevice,
  generateSecureToken,
  generateUuid,
  getClientIp,
  getUserAgent,
  safeEqual,
  sha256,
} from '@secureauthx/shared';
import type {
  AuditRepository,
  MfaRepository,
  PrismaClient,
  UserRepository,
} from '@secureauthx/database';
import { Errors } from '../utils/errors';
import { env } from '../config/env';

interface MfaServiceDeps {
  prisma: PrismaClient;
  password: PasswordService;
  users: UserRepository;
  mfa: MfaRepository;
  audits: AuditRepository;
  cipher: AtRestCipher;
}

/** Server-side state backing a pending second-factor login. */
interface LoginChallengeState {
  userId: string;
  /** rememberMe chosen on the password step, preserved for token TTL. */
  rememberMe: boolean;
  availableMethods: MfaMethod[];
  createdAt: number;
}

/** Expected values captured when a WebAuthn ceremony is initiated. */
interface WebAuthnCeremonyState {
  kind: 'register' | 'authenticate';
  userId: string;
  /** Id of the login challenge this ceremony is completing, for kind='authenticate'. */
  loginChallengeId?: string;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
  createdAt: number;
}

/**
 * TTL store for short-lived MFA state. Single-process by design (the app is
 * self-hosted single-instance); swap for Redis when horizontally scaled.
 */
class TtlStore<T extends { createdAt: number }> {
  private readonly items = new Map<string, { data: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  set(id: string, data: T): void {
    this.items.set(id, { data, expiresAt: Date.now() + this.ttlMs });
  }

  get(id: string): T | null {
    const item = this.items.get(id);
    if (!item) return null;
    if (item.expiresAt < Date.now()) {
      this.items.delete(id);
      return null;
    }
    return item.data;
  }

  delete(id: string): void {
    this.items.delete(id);
  }
}

const AUTHENTICATION_TIMEOUT_MS = 60000;

/**
 * Implements all multi-factor flows: enrollment, login verification,
 * recovery codes, WebAuthn ceremonies, trusted devices, and disabling.
 */
export class MfaService {
  private readonly loginChallenges = new TtlStore<LoginChallengeState>(env.MFA_CHALLENGE_TTL * 1000);
  private readonly ceremonies = new TtlStore<WebAuthnCeremonyState>(env.MFA_CHALLENGE_TTL * 1000);

  constructor(private readonly deps: MfaServiceDeps) {}

  // -------------------------------------------------------------------------
  // Challenge lifecycle (login gate)
  // -------------------------------------------------------------------------

  async issueLoginChallenge(
    userId: string,
    rememberMe: boolean
  ): Promise<{ challengeId: string; method: MfaMethod; availableMethods: MfaMethod[]; expiresAt: string }> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw Errors.unauthorized('Account no longer exists.');

    const availableMethods: MfaMethod[] = [];
    if (user.totpEnabled) availableMethods.push('totp');
    if (user.webauthnEnabled) availableMethods.push('webauthn');
    availableMethods.push('recovery');

    const challengeId = generateUuid();
    this.loginChallenges.set(challengeId, {
      userId,
      rememberMe,
      availableMethods,
      createdAt: Date.now(),
    });

    return {
      challengeId,
      method: availableMethods[0] ?? 'recovery',
      availableMethods,
      expiresAt: new Date(Date.now() + env.MFA_CHALLENGE_TTL * 1000).toISOString(),
    };
  }

  /** Resolves the user bound to a pending challenge, or throws. */
  private getChallengeUser(challengeId: string): string {
    const state = this.loginChallenges.get(challengeId);
    if (!state) {
      throw Errors.unauthorized('MFA challenge is invalid or has expired.');
    }
    return state.userId;
  }

  // -------------------------------------------------------------------------
  // Login verification — TOTP
  // -------------------------------------------------------------------------

  async verifyTotpLogin(
    challengeId: string,
    code: string,
    rememberDevice: boolean,
    req: Request
  ): Promise<{ userId: string; deviceToken: string | null }> {
    const userId = this.getChallengeUser(challengeId);

    const record = await this.deps.mfa.getTotpSecret(userId);
    if (!record) {
      await this.deps.audits.log(userId, AUDIT_ACTION.MFA_LOGIN_FAILED, 'WARN', req, {
        method: 'totp',
        reason: 'no_secret',
      });
      throw Errors.unauthorized('Invalid authentication code.');
    }

    let secret: string;
    try {
      secret = this.deps.cipher.decrypt(record.secret);
    } catch {
      await this.deps.audits.log(userId, AUDIT_ACTION.MFA_LOGIN_FAILED, 'WARN', req, {
        method: 'totp',
        reason: 'decrypt_failed',
      });
      throw Errors.internal('Could not verify the authentication code.');
    }

    if (!verifyTotp(secret, code, { window: MFA_CONFIG.TOTP_DRIFT_STEPS })) {
      await this.deps.audits.log(userId, AUDIT_ACTION.MFA_LOGIN_FAILED, 'WARN', req, {
        method: 'totp',
        reason: 'invalid_code',
      });
      throw Errors.unauthorized('Invalid authentication code.');
    }

    this.loginChallenges.delete(challengeId);
    const deviceToken = rememberDevice ? await this.trustDevice(userId, req) : null;
    return { userId, deviceToken };
  }

  // -------------------------------------------------------------------------
  // Login verification — recovery codes
  // -------------------------------------------------------------------------

  async verifyRecoveryLogin(challengeId: string, code: string, req: Request): Promise<string> {
    const userId = this.getChallengeUser(challengeId);

    const normalized = code.toLowerCase().replace(/[^a-z0-9]/g, '');
    const consumed = await this.deps.mfa.consumeRecoveryCode(userId, sha256(normalized));
    if (!consumed) {
      await this.deps.audits.log(userId, AUDIT_ACTION.MFA_LOGIN_FAILED, 'WARN', req, {
        method: 'recovery',
        reason: 'invalid_code',
      });
      throw Errors.unauthorized('Invalid recovery code.');
    }

    this.loginChallenges.delete(challengeId);
    await this.deps.audits.log(userId, AUDIT_ACTION.RECOVERY_CODE_USED, 'INFO', req);
    return userId;
  }

  // -------------------------------------------------------------------------
  // Login verification — WebAuthn
  // -------------------------------------------------------------------------

  async beginWebAuthnLogin(
    challengeId: string
  ): Promise<{ options: PublicKeyCredentialRequestOptionsJSON }> {
    const userId = this.getChallengeUser(challengeId);
    const credentials = await this.deps.mfa.listCredentials(userId);

    const options = await generateAuthenticationOptions({
      rpID: env.WEBAUTHN_RP_ID,
      timeout: AUTHENTICATION_TIMEOUT_MS,
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
      userVerification: 'discouraged',
    });

    this.ceremonies.set(challengeId, {
      kind: 'authenticate',
      userId,
      loginChallengeId: challengeId,
      expectedChallenge: options.challenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
      createdAt: Date.now(),
    });

    return { options };
  }

  async verifyWebAuthnLogin(
    challengeId: string,
    credential: AuthenticationResponseJSON,
    rememberDevice: boolean,
    req: Request
  ): Promise<{ userId: string; deviceToken: string | null }> {
    const userId = this.getChallengeUser(challengeId);
    const ceremony = this.ceremonies.get(challengeId);
    if (!ceremony || ceremony.kind !== 'authenticate') {
      throw Errors.unauthorized('MFA challenge is invalid or has expired.');
    }

    const stored = await this.deps.mfa.getCredentialForUser(userId, credential.id);
    if (!stored) {
      await this.deps.audits.log(userId, AUDIT_ACTION.MFA_LOGIN_FAILED, 'WARN', req, {
        method: 'webauthn',
        reason: 'unknown_credential',
      });
      throw Errors.unauthorized('Invalid security key.');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: ceremony.expectedChallenge,
        expectedOrigin: ceremony.expectedOrigin,
        expectedRPID: ceremony.expectedRPID,
        credential: {
          id: stored.credentialId,
          publicKey: Buffer.from(stored.publicKey, 'base64url'),
          counter: stored.signCount,
          transports: stored.transports as AuthenticatorTransportFuture[],
        },
        requireUserVerification: false,
      });
    } catch {
      await this.deps.audits.log(userId, AUDIT_ACTION.MFA_LOGIN_FAILED, 'WARN', req, {
        method: 'webauthn',
        reason: 'verification_error',
      });
      throw Errors.unauthorized('Security key verification failed.');
    }

    if (!verification.verified) {
      await this.deps.audits.log(userId, AUDIT_ACTION.MFA_LOGIN_FAILED, 'WARN', req, {
        method: 'webauthn',
        reason: 'signature_invalid',
      });
      throw Errors.unauthorized('Security key verification failed.');
    }

    await this.deps.mfa.updateCredentialCounter(stored.credentialId, verification.authenticationInfo.newCounter);
    this.ceremonies.delete(challengeId);
    this.loginChallenges.delete(challengeId);

    const deviceToken = rememberDevice ? await this.trustDevice(userId, req) : null;
    return { userId, deviceToken };
  }

  // -------------------------------------------------------------------------
  // Enrollment — TOTP
  // -------------------------------------------------------------------------

  async beginTotpEnrollment(
    userId: string
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw Errors.notFound('User not found.');

    const secret = generateTotpSecret();
    await this.deps.mfa.upsertPendingTotpSecret(userId, this.deps.cipher.encrypt(secret));

    return {
      secret,
      otpauthUrl: buildOtpauthUrl({
        secret,
        accountName: user.email,
        issuer: MFA_CONFIG.TOTP_ISSUER,
      }),
    };
  }

  async completeTotpEnrollment(userId: string, code: string, req: Request): Promise<string[]> {
    const record = await this.deps.mfa.getTotpSecret(userId);
    if (!record) {
      throw Errors.badRequest('Start TOTP setup before verifying a code.');
    }

    let secret: string;
    try {
      secret = this.deps.cipher.decrypt(record.secret);
    } catch {
      throw Errors.internal('Could not verify the enrollment code.');
    }

    if (!verifyTotp(secret, code, { window: MFA_CONFIG.TOTP_DRIFT_STEPS })) {
      throw Errors.badRequest('The code is incorrect or has expired. Try again.');
    }

    await this.deps.mfa.enableTotp(userId);
    await this.deps.users.update(userId, { totpEnabled: true, mfaEnabled: true });
    await this.deps.audits.log(userId, AUDIT_ACTION.TOTP_ENABLED, 'INFO', req, { method: 'totp' });

    return this.ensureRecoveryCodes(userId, req);
  }

  // -------------------------------------------------------------------------
  // Enrollment — WebAuthn
  // -------------------------------------------------------------------------

  async beginWebAuthnRegistration(
    userId: string
  ): Promise<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw Errors.notFound('User not found.');

    const existing = await this.deps.mfa.listCredentials(userId);
    const options = await generateRegistrationOptions({
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      userName: user.email,
      userDisplayName: user.email,
      userID: Buffer.from(user.id, 'utf8'),
      timeout: AUTHENTICATION_TIMEOUT_MS,
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
    });

    const challengeId = generateUuid();
    this.ceremonies.set(challengeId, {
      kind: 'register',
      userId,
      expectedChallenge: options.challenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
      createdAt: Date.now(),
    });

    return { challengeId, options };
  }

  async completeWebAuthnRegistration(
    challengeId: string,
    userId: string,
    deviceName: string,
    registration: RegistrationResponseJSON,
    req: Request
  ): Promise<string[]> {
    const ceremony = this.ceremonies.get(challengeId);
    if (!ceremony || ceremony.kind !== 'register') {
      throw Errors.badRequest('Registration session is invalid or has expired.');
    }
    if (ceremony.userId !== userId) {
      throw Errors.forbidden('Registration session does not belong to this account.');
    }

    const verification = await verifyRegistrationResponse({
      response: registration,
      expectedChallenge: ceremony.expectedChallenge,
      expectedOrigin: ceremony.expectedOrigin,
      expectedRPID: ceremony.expectedRPID,
      requireUserVerification: false,
    });

    if (!verification.verified) {
      throw Errors.badRequest('Security key verification failed.');
    }

    const { credential } = verification.registrationInfo;
    await this.deps.mfa.createCredential({
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      signCount: credential.counter,
      deviceName: deviceName || describeDevice(getUserAgent(req)),
      transports: registration.response.transports ?? [],
      aaguid: verification.registrationInfo.aaguid,
    });

    await this.deps.users.update(userId, { webauthnEnabled: true, mfaEnabled: true });
    await this.deps.audits.log(userId, AUDIT_ACTION.WEBAUTHN_REGISTERED, 'INFO', req, {
      method: 'webauthn',
      credentialId: credential.id,
    });

    this.ceremonies.delete(challengeId);
    return this.ensureRecoveryCodes(userId, req);
  }

  // -------------------------------------------------------------------------
  // Recovery codes
  // -------------------------------------------------------------------------

  /** Issues a fresh batch of recovery codes only when the user has none left. */
  private async ensureRecoveryCodes(userId: string, req: Request): Promise<string[]> {
    const remaining = await this.deps.mfa.countUnusedRecoveryCodes(userId);
    if (remaining > 0) return [];

    return this.regenerateRecoveryCodes(userId, req);
  }

  /** Re-issues recovery codes after re-verifying the account password. */
  async regenerateRecoveryCodesWithPassword(userId: string, password: string, req: Request): Promise<string[]> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw Errors.notFound('User not found.');

    const valid = await this.deps.password.verify(password, user.passwordHash ?? '');
    if (!valid) {
      throw Errors.forbidden('Incorrect password.');
    }

    return this.regenerateRecoveryCodes(userId, req);
  }

  async regenerateRecoveryCodes(userId: string, req: Request): Promise<string[]> {
    const codes: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < MFA_CONFIG.RECOVERY_CODES_COUNT; i += 1) {
      const code = this.formatRecoveryCode();
      codes.push(code);
      hashes.push(sha256(code.toLowerCase().replace(/[^a-z0-9]/g, '')));
    }

    await this.deps.mfa.deleteRecoveryCodes(userId);
    await this.deps.mfa.createRecoveryCodes(userId, hashes);
    await this.deps.audits.log(userId, AUDIT_ACTION.RECOVERY_CODES_GENERATED, 'INFO', req);

    return codes;
  }

  /** 12-char hex code in 4-char groups: `abcd-ef12-3456` (unambiguous charset). */
  private formatRecoveryCode(): string {
    const hex = randomBytes(8).toString('hex');
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
  }

  // -------------------------------------------------------------------------
  // Status & disable
  // -------------------------------------------------------------------------

  async getStatus(userId: string): Promise<MfaStatus> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw Errors.notFound('User not found.');

    const credentials = await this.deps.mfa.listCredentials(userId);
    const recoveryCodesRemaining = await this.deps.mfa.countUnusedRecoveryCodes(userId);

    const webauthnCredentials: WebAuthnCredentialInfo[] = credentials.map((c) => ({
      id: c.credentialId,
      name: c.deviceName,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt.toISOString(),
    }));

    return {
      mfaEnabled: user.mfaEnabled,
      totpEnabled: user.totpEnabled,
      webauthnEnabled: user.webauthnEnabled,
      webauthnCredentials,
      recoveryCodesRemaining,
    };
  }

  async removeWebAuthnCredential(userId: string, credentialId: string, req: Request): Promise<void> {
    const exists = await this.deps.mfa.getCredentialForUser(userId, credentialId);
    if (!exists) throw Errors.notFound('Security key not found.');

    await this.deps.mfa.deleteCredential(userId, credentialId);
    await this.deps.audits.log(userId, AUDIT_ACTION.WEBAUTHN_REMOVED, 'INFO', req, { credentialId });

    const remaining = await this.deps.mfa.countCredentials(userId);
    const totp = await this.deps.mfa.getTotpSecret(userId);
    if (remaining === 0 && !totp?.enabled) {
      await this.deps.users.update(userId, { webauthnEnabled: false, mfaEnabled: false });
    } else if (remaining === 0) {
      await this.deps.users.update(userId, { webauthnEnabled: false });
    }
  }

  /** Disables every MFA method after re-verifying the account password. */
  async disable(userId: string, password: string, req: Request): Promise<void> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw Errors.notFound('User not found.');

    const valid = await this.deps.password.verify(password, user.passwordHash ?? '');
    if (!valid) {
      throw Errors.forbidden('Incorrect password.');
    }

    await this.deps.mfa.deleteTotpSecret(userId);
    await this.deps.mfa.deleteRecoveryCodes(userId);
    const credentials = await this.deps.mfa.listCredentials(userId);
    for (const credential of credentials) {
      await this.deps.mfa.deleteCredential(userId, credential.credentialId);
    }
    await this.deps.mfa.revokeAllTrustedDevices(userId);

    await this.deps.users.update(userId, {
      totpEnabled: false,
      webauthnEnabled: false,
      mfaEnabled: false,
    });

    await this.deps.audits.log(userId, AUDIT_ACTION.TOTP_DISABLED, 'INFO', req, {
      reason: 'mfa_disabled',
      removedCredentials: credentials.length,
    });
  }

  // -------------------------------------------------------------------------
  // Trusted devices
  // -------------------------------------------------------------------------

  private async trustDevice(userId: string, req: Request): Promise<string> {
    const token = generateSecureToken(32);
    const ip = getClientIp(req);
    await this.deps.mfa.trustDevice({
      userId,
      fingerprint: sha256(token),
      deviceName: describeDevice(getUserAgent(req)),
      ipAddress: ip,
    });

    await this.deps.audits.log(userId, AUDIT_ACTION.DEVICE_TRUSTED, 'INFO', req, { ip });
    return token;
  }

  /** Returns true when the request's trusted-device cookie maps to a stored device. */
  async isDeviceTrusted(userId: string, req: Request): Promise<boolean> {
    const token = req.cookies?.[COOKIE_NAMES.TRUSTED_DEVICE];
    if (typeof token !== 'string' || token.length === 0) return false;

    const device = await this.deps.mfa.getTrustedDevice(userId, sha256(token));
    if (!device) return false;

    await this.deps.mfa.touchTrustedDevice(userId, device.deviceFingerprint);
    return true;
  }

  /** Validates that the request's challenge cookie matches the body challengeId. */
  challengeCookieMatches(req: Request, challengeId: string): boolean {
    const cookie = req.cookies?.[COOKIE_NAMES.MFA_CHALLENGE];
    if (typeof cookie !== 'string') return false;
    return safeEqual(cookie, challengeId);
  }
}
