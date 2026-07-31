import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * RFC 6238 TOTP — implemented from scratch on top of node:crypto.
 *
 * - Base32 encoding/decoding (RFC 4648, no padding)
 * - HMAC-SHA1/256/512 HOTP dynamic truncation (RFC 4226)
 * - Constant-time code comparison
 * - otpauth:// URI builder for authenticator apps / QR codes
 */

export type TotpHashAlgorithm = 'sha1' | 'sha256' | 'sha512';

export interface TotpOptions {
  /** Time step in seconds (RFC 6238 default: 30). */
  stepSeconds?: number;
  /** Number of digits in the code (RFC 6238 default: 6). */
  digits?: number;
  /** HMAC algorithm (RFC 6238 default: sha1). */
  algorithm?: TotpHashAlgorithm;
  /** Override the reference time (ms epoch). Defaults to Date.now(). */
  timestamp?: number;
}

export interface VerifyTotpOptions extends TotpOptions {
  /**
   * Number of time steps before/after the current one that are accepted
   * to tolerate clock drift and slow typing. Default: 1.
   */
  window?: number;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const DEFAULT_STEP_SECONDS = 30;
export const DEFAULT_DIGITS = 6;
export const DEFAULT_ALGORITHM: TotpHashAlgorithm = 'sha1';
export const DEFAULT_WINDOW = 1;

// ---------------------------------------------------------------------------
// Base32 (RFC 4648)
// ---------------------------------------------------------------------------

/** Encodes a buffer as uppercase Base32 (no padding). */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/** Decodes an uppercase Base32 string (padding and mixed case tolerated). */
export function base32Decode(value: string): Buffer {
  const cleaned = value.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  if (cleaned.length === 0) {
    return Buffer.alloc(0);
  }

  let bits = 0;
  let current = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ---------------------------------------------------------------------------
// HOTP / TOTP (RFC 4226 / RFC 6238)
// ---------------------------------------------------------------------------

/**
 * Computes the HOTP value for a counter using dynamic truncation.
 * The result is zero-padded to `digits` characters.
 */
export function generateHmacOtp(secret: string, counter: number, options: TotpOptions = {}): string {
  const digits = options.digits ?? DEFAULT_DIGITS;
  const algorithm = options.algorithm ?? DEFAULT_ALGORITHM;
  if (digits < 6 || digits > 10) {
    throw new Error('TOTP digits must be between 6 and 10.');
  }

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const key = base32Decode(secret);
  if (key.length === 0) {
    throw new Error('TOTP secret must contain at least one valid base32 character.');
  }

  const digest = createHmac(algorithm, key).update(counterBuffer).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;

  const code = (binary % 10 ** digits).toString().padStart(digits, '0');
  return code;
}

/** Maps a Unix time (seconds) to the TOTP counter for the given time step. */
export function timeToCounter(timestampSeconds: number, stepSeconds = DEFAULT_STEP_SECONDS): number {
  return Math.floor(timestampSeconds / stepSeconds);
}

/**
 * Computes the current TOTP code for a secret.
 */
export function generateTotp(secret: string, options: TotpOptions = {}): string {
  const stepSeconds = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const timestamp = options.timestamp ?? Date.now();
  const counter = timeToCounter(Math.floor(timestamp / 1000), stepSeconds);
  return generateHmacOtp(secret, counter, options);
}

/**
 * Verifies a TOTP code in constant time, accepting a window of adjacent
 * time steps to tolerate clock drift. Returns true only for a valid match.
 */
export function verifyTotp(secret: string, code: string, options: VerifyTotpOptions = {}): boolean {
  const window = options.window ?? DEFAULT_WINDOW;
  if (window < 0 || window > 10) {
    throw new Error('TOTP verification window must be between 0 and 10.');
  }

  const digits = options.digits ?? DEFAULT_DIGITS;
  const normalized = code.trim();
  if (!new RegExp(`^\\d{${digits}}$`).test(normalized)) {
    return false;
  }

  const timestamp = options.timestamp ?? Date.now();
  const stepSeconds = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const counter = timeToCounter(Math.floor(timestamp / 1000), stepSeconds);

  const supplied = Buffer.from(normalized, 'utf8');
  for (let i = counter - window; i <= counter + window; i += 1) {
    const candidate = Buffer.from(generateHmacOtp(secret, i, options), 'utf8');
    if (candidate.length === supplied.length && timingSafeEqual(candidate, supplied)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Secret & URI generation
// ---------------------------------------------------------------------------

/**
 * Generates a fresh random TOTP secret as Base32.
 * The default of 20 bytes (160 bits) matches RFC 4226 recommendations.
 */
export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

/**
 * Builds an `otpauth://` provisioning URI suitable for QR codes.
 */
export function buildOtpauthUrl(options: {
  secret: string;
  accountName: string;
  issuer: string;
  algorithm?: TotpHashAlgorithm;
  digits?: number;
  stepSeconds?: number;
}): string {
  const { secret, accountName, issuer } = options;
  const algorithm = options.algorithm ?? DEFAULT_ALGORITHM;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const stepSeconds = options.stepSeconds ?? DEFAULT_STEP_SECONDS;

  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: algorithm.toUpperCase(),
    digits: String(digits),
    period: String(stepSeconds),
  });

  const label = `${issuer}:${accountName}`;
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}
