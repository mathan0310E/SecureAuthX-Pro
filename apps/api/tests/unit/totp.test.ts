import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  buildOtpauthUrl,
  generateTotp,
  generateTotpSecret,
  verifyTotp,
} from '@secureauthx/security';

describe('TOTP primitives', () => {
  it('base32 round-trips arbitrary bytes', () => {
    const bytes = Buffer.from('Hello, SecureAuthX!', 'utf8');
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('generates a 32-char base32 secret by default (20 bytes)', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('produces a 6-digit numeric code', () => {
    const secret = generateTotpSecret();
    expect(generateTotp(secret)).toMatch(/^\d{6}$/);
  });

  it('verifies a freshly generated code', () => {
    const secret = generateTotpSecret();
    const code = generateTotp(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('rejects a wrong code and a malformed code', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
    expect(verifyTotp(secret, 'abc')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('accepts a code from an adjacent time step within the window', () => {
    const secret = generateTotpSecret();
    const step = 30;
    const now = Date.now();
    const earlier = now - step * 1000;
    const earlierCode = generateTotp(secret, { timestamp: earlier, stepSeconds: step });
    expect(verifyTotp(secret, earlierCode, { timestamp: now, stepSeconds: step })).toBe(true);
  });

  it('rejects a code outside the window', () => {
    const secret = generateTotpSecret();
    const step = 30;
    const now = Date.now();
    const oldCode = generateTotp(secret, {
      timestamp: now - step * 5000,
      stepSeconds: step,
    });
    expect(verifyTotp(secret, oldCode, { timestamp: now, stepSeconds: step })).toBe(false);
  });

  it('builds a valid otpauth URL with issuer, account and params', () => {
    const secret = generateTotpSecret();
    const url = buildOtpauthUrl({
      secret,
      accountName: 'user@example.com',
      issuer: 'SecureAuthX Pro',
    });
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain(`secret=${secret}`);
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
  });
});
