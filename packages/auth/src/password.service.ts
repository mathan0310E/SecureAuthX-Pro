import bcrypt from 'bcryptjs';

/**
 * Password hashing and verification using bcrypt.
 * bcrypt is intentionally used over faster algorithms (scrypt/PBKDF2 in
 * runtime JS is easy to get wrong) because it is memory-hard, well-audited,
 * and has a cost factor that can be tuned as hardware improves.
 */
export class PasswordService {
  constructor(private readonly rounds: number) {}

  async hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.rounds);
  }

  /**
   * Verifies a plaintext password against a stored hash.
   * Returns `false` (never throws) on any mismatch.
   */
  async verify(plaintext: string, hash: string): Promise<boolean> {
    if (!plaintext || !hash) return false;
    try {
      return await bcrypt.compare(plaintext, hash);
    } catch {
      return false;
    }
  }

  /**
   * Performs a dummy hash/compare to keep response times constant when a
   * user does not exist, mitigating user-enumeration timing attacks.
   */
  async verifyDummy(): Promise<boolean> {
    const dummyHash = await bcrypt.hash('dummy-password-placeholder', this.rounds);
    return bcrypt.compare('dummy-password-placeholder', dummyHash);
  }
}

export const createPasswordService = (rounds: number): PasswordService =>
  new PasswordService(rounds);
