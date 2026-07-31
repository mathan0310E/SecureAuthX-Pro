import type { PrismaClient } from '@prisma/client';

/**
 * MFA material persistence — TOTP secrets, recovery codes, WebAuthn
 * credentials and trusted devices. Secrets and hashes are written as
 * already-transformed values; this layer never sees plaintext keys.
 */
export class MfaRepository {
  constructor(private readonly db: PrismaClient) {}

  // -------------------------------------------------------------------------
  // TOTP
  // -------------------------------------------------------------------------

  getTotpSecret(userId: string) {
    return this.db.totpSecret.findUnique({ where: { userId } });
  }

  /** Creates or overwrites the pending (unverified) TOTP secret. */
  upsertPendingTotpSecret(userId: string, encryptedSecret: string) {
    return this.db.totpSecret.upsert({
      where: { userId },
      create: { userId, secret: encryptedSecret, verified: false, enabled: false },
      update: { secret: encryptedSecret, verified: false, enabled: false },
    });
  }

  verifyTotpSecret(userId: string) {
    return this.db.totpSecret.update({
      where: { userId },
      data: { verified: true },
    });
  }

  enableTotp(userId: string) {
    return this.db.totpSecret.update({
      where: { userId },
      data: { verified: true, enabled: true },
    });
  }

  async deleteTotpSecret(userId: string): Promise<void> {
    await this.db.totpSecret.deleteMany({ where: { userId } });
  }

  // -------------------------------------------------------------------------
  // Recovery codes
  // -------------------------------------------------------------------------

  async createRecoveryCodes(userId: string, codeHashes: string[]): Promise<void> {
    await this.db.recoveryCode.createMany({
      data: codeHashes.map((codeHash) => ({ userId, codeHash })),
    });
  }

  /** Atomically claims an unused recovery code; returns true when claimed. */
  async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    const result = await this.db.recoveryCode.updateMany({
      where: { userId, codeHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    return result.count === 1;
  }

  async countUnusedRecoveryCodes(userId: string): Promise<number> {
    return this.db.recoveryCode.count({ where: { userId, usedAt: null } });
  }

  async deleteRecoveryCodes(userId: string): Promise<void> {
    await this.db.recoveryCode.deleteMany({ where: { userId } });
  }

  // -------------------------------------------------------------------------
  // WebAuthn credentials
  // -------------------------------------------------------------------------

  getCredential(credentialId: string) {
    return this.db.webAuthnCredential.findUnique({
      where: { credentialId },
      include: { user: true },
    });
  }

  getCredentialForUser(userId: string, credentialId: string) {
    return this.db.webAuthnCredential.findFirst({
      where: { userId, credentialId },
    });
  }

  createCredential(data: {
    userId: string;
    credentialId: string;
    publicKey: string;
    signCount: number;
    deviceName: string;
    transports: string[];
    aaguid?: string | null;
  }) {
    return this.db.webAuthnCredential.create({
      data: {
        userId: data.userId,
        credentialId: data.credentialId,
        publicKey: data.publicKey,
        signCount: data.signCount,
        deviceName: data.deviceName,
        transports: data.transports,
        aaguid: data.aaguid ?? null,
        lastUsedAt: new Date(),
      },
    });
  }

  updateCredentialCounter(credentialId: string, signCount: number) {
    return this.db.webAuthnCredential.update({
      where: { credentialId },
      data: { signCount, lastUsedAt: new Date() },
    });
  }

  listCredentials(userId: string) {
    return this.db.webAuthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async countCredentials(userId: string): Promise<number> {
    return this.db.webAuthnCredential.count({ where: { userId } });
  }

  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    await this.db.webAuthnCredential.deleteMany({ where: { userId, credentialId } });
  }

  // -------------------------------------------------------------------------
  // Trusted devices
  // -------------------------------------------------------------------------

  getTrustedDevice(userId: string, fingerprint: string) {
    return this.db.trustedDevice.findUnique({
      where: { userId_deviceFingerprint: { userId, deviceFingerprint: fingerprint } },
    });
  }

  touchTrustedDevice(userId: string, fingerprint: string) {
    return this.db.trustedDevice.update({
      where: { userId_deviceFingerprint: { userId, deviceFingerprint: fingerprint } },
      data: { lastUsedAt: new Date() },
    });
  }

  trustDevice(data: {
    userId: string;
    fingerprint: string;
    deviceName: string;
    platform?: string | null;
    browser?: string | null;
    ipAddress?: string | null;
  }) {
    return this.db.trustedDevice.upsert({
      where: { userId_deviceFingerprint: { userId: data.userId, deviceFingerprint: data.fingerprint } },
      create: {
        userId: data.userId,
        deviceFingerprint: data.fingerprint,
        deviceName: data.deviceName,
        platform: data.platform ?? null,
        browser: data.browser ?? null,
        ipAddress: data.ipAddress ?? null,
      },
      update: { lastUsedAt: new Date() },
    });
  }

  listTrustedDevices(userId: string) {
    return this.db.trustedDevice.findMany({
      where: { userId },
      orderBy: { trustedAt: 'desc' },
    });
  }

  async revokeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    await this.db.trustedDevice.deleteMany({ where: { userId, id: deviceId } });
  }

  async revokeAllTrustedDevices(userId: string): Promise<void> {
    await this.db.trustedDevice.deleteMany({ where: { userId } });
  }
}
