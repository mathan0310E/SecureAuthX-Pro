import { describe, expect, it } from 'vitest';
import { AtRestCipher } from '@secureauthx/security';

describe('AtRestCipher (AES-256-GCM)', () => {
  it('requires a 32-byte key', () => {
    expect(() => new AtRestCipher({ key: Buffer.from('short') })).toThrow();
    const key = AtRestCipher.deriveKey('test-secret-passphrase');
    expect(key.length).toBe(32);
  });

  it('round-trips plaintext', () => {
    const cipher = new AtRestCipher({ key: AtRestCipher.deriveKey('a-secret') });
    const payload = cipher.encrypt('super-secret-totp-secret');
    expect(payload.startsWith('v1:')).toBe(true);
    expect(payload).not.toContain('super-secret-totp-secret');
    expect(cipher.decrypt(payload)).toBe('super-secret-totp-secret');
  });

  it('is random: encrypting twice yields different payloads', () => {
    const cipher = new AtRestCipher({ key: AtRestCipher.deriveKey('a-secret') });
    const a = cipher.encrypt('same');
    const b = cipher.encrypt('same');
    expect(a).not.toBe(b);
  });

  it('fails to decrypt tampered or malformed payloads', () => {
    const cipher = new AtRestCipher({ key: AtRestCipher.deriveKey('a-secret') });
    const payload = cipher.encrypt('secret');
    const tampered = payload.slice(0, -2) + (payload.endsWith('AA') ? 'BB' : 'AA');
    expect(() => cipher.decrypt(tampered)).toThrow();
    expect(() => cipher.decrypt('nope')).toThrow();
    expect(() => cipher.decrypt('v1:')).toThrow();
  });

  it('cannot decrypt with a different key', () => {
    const a = new AtRestCipher({ key: AtRestCipher.deriveKey('key-a') });
    const b = new AtRestCipher({ key: AtRestCipher.deriveKey('key-b') });
    const payload = a.encrypt('secret');
    expect(() => b.decrypt(payload)).toThrow();
  });
});
