import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';

/**
 * Generates a cryptographically-secure URL-safe token.
 * @param bytes Number of random bytes (default 32 -> 43 chars).
 */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Generates a UUID v4 (used for all primary keys).
 */
export function generateUuid(): string {
  return randomUUID();
}

/**
 * Generates a numeric code (email verification, etc.).
 * @param length Number of digits (default 6).
 */
export function generateNumericCode(length = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  const range = max - min + 1;
  const buffer = randomBytes(8);
  const rand = buffer.readUInt32BE(0) % range;
  return String(rand + min).padStart(length, '0');
}

/**
 * Creates an opaque SHA-256 hash of a value (device fingerprints, token lookups).
 * Output is hex. Do NOT use for passwords — use bcrypt.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Constant-time string comparison (prevents timing attacks on comparisons).
 */
export function safeEqual(known: string, supplied: string): boolean {
  const a = Buffer.from(known);
  const b = Buffer.from(supplied);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Masks a value for logs, retaining only a hint of the tail.
 * e.g. maskSensitive('a1b2c3d4') -> '****d4'
 */
export function maskValue(value: string, visibleTail = 4): string {
  if (value.length <= visibleTail) return '****';
  return `${'*'.repeat(Math.max(value.length - visibleTail, 4))}${value.slice(-visibleTail)}`;
}

/**
 * Returns a cryptographically strong random hex string for CSRF tokens.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}
