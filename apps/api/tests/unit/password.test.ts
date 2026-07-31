import { describe, expect, it } from 'vitest';
import { PasswordService, createPasswordService } from '@secureauthx/auth';
import { evaluatePassword } from '@secureauthx/security';

describe('PasswordService', () => {
  const service = createPasswordService(4);

  it('hashes and verifies a password', async () => {
    const hash = await service.hash('CorrectHorseBatteryStaple!2026');
    expect(hash).not.toBe('CorrectHorseBatteryStaple!2026');
    expect(await service.verify('CorrectHorseBatteryStaple!2026', hash)).toBe(true);
    expect(await service.verify('WrongPassword!2026', hash)).toBe(false);
  });

  it('never throws on a malformed hash (returns false)', async () => {
    expect(await service.verify('x', 'not-a-bcrypt-hash')).toBe(false);
    expect(await service.verify('', '')).toBe(false);
  });

  it('dummy verify always resolves without error', async () => {
    await expect(service.verifyDummy()).resolves.toBe(true);
  });
});

describe('evaluatePassword policy', () => {
  it('accepts a strong password', () => {
    const result = evaluatePassword('CorrectHorseBatteryStaple!2026');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a short password', () => {
    const result = evaluatePassword('abc123!', { minLength: 12, maxLength: 128 });
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('least 12');
  });

  it('rejects common substrings (e.g. "password")', () => {
    const result = evaluatePassword('MyPassword123!', { minLength: 12, maxLength: 128 });
    expect(result.valid).toBe(false);
    expect(result.errors.join().toLowerCase()).toContain('predictable');
  });

  it('classifies strength tiers', () => {
    expect(evaluatePassword('a').score.strength).toBe('weak');
    expect(evaluatePassword('CorrectHorseBatteryStaple!2026').score.strength).toBe('very-strong');
  });
});
