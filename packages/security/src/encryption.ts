import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Authenticated symmetric encryption for secrets at rest (AES-256-GCM).
 *
 * Payload format (single string stored in the DB):
 *   `v1:<base64(iv || tag || ciphertext)>`
 *
 * The 12-byte IV is random per encryption; the 16-byte auth tag guarantees
 * integrity, so tampered rows fail to decrypt instead of yielding garbage.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = 'v1:';

export interface AtRestCipherConfig {
  /** 32-byte key. Must be stable across restarts or stored secrets become unreadable. */
  key: Buffer;
}

export class AtRestCipher {
  private readonly key: Buffer;

  constructor(config: AtRestCipherConfig) {
    if (!config.key || config.key.length !== 32) {
      throw new Error('AtRestCipher requires a 32-byte (256-bit) key.');
    }
    this.key = config.key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`;
  }

  decrypt(payload: string): string {
    if (!payload.startsWith(PREFIX)) {
      throw new Error('Encrypted payload is missing the version prefix.');
    }
    const raw = Buffer.from(payload.slice(PREFIX.length), 'base64');
    if (raw.length < IV_BYTES + TAG_BYTES) {
      throw new Error('Encrypted payload is malformed.');
    }

    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  /** Derives a 32-byte key from a passphrase via SHA-256 (convenience for dev). */
  static deriveKey(secret: string): Buffer {
    return createHash('sha256').update(secret).digest();
  }
}
