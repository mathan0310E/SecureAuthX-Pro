import { EXCLUDED_PASSWORD_SUBSTRINGS } from '@secureauthx/config';

export type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very-strong';

export interface PasswordScore {
  score: number; // 0-100
  strength: PasswordStrength;
  checks: PasswordCheck[];
}

export interface PasswordCheck {
  name: string;
  passed: boolean;
  hint: string;
}

export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
  score: PasswordScore;
}

const CHECK_NAMES = [
  'length',
  'uppercase',
  'lowercase',
  'number',
  'symbol',
  'no-common',
] as const;

/**
 * Evaluates a password against the platform policy.
 * Enforces the configured length bounds, character-class diversity,
 * and rejection of common/weak substrings.
 */
export function evaluatePassword(
  password: string,
  policy: {
    minLength: number;
    maxLength: number;
  } = { minLength: 12, maxLength: 128 }
): PasswordPolicyResult {
  const errors: string[] = [];
  const checks: PasswordCheck[] = [
    {
      name: 'length',
      passed: password.length >= policy.minLength && password.length <= policy.maxLength,
      hint: `${policy.minLength}-${policy.maxLength} characters`,
    },
    { name: 'uppercase', passed: /[A-Z]/.test(password), hint: 'Contains an uppercase letter' },
    { name: 'lowercase', passed: /[a-z]/.test(password), hint: 'Contains a lowercase letter' },
    { name: 'number', passed: /\d/.test(password), hint: 'Contains a number' },
    { name: 'symbol', passed: /[^A-Za-z0-9]/.test(password), hint: 'Contains a symbol' },
    {
      name: 'no-common',
      passed: !EXCLUDED_PASSWORD_SUBSTRINGS.some((s) =>
        password.toLowerCase().includes(s.toLowerCase())
      ),
      hint: 'Avoids predictable substrings',
    },
  ];

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long.`);
  }
  if (password.length > policy.maxLength) {
    errors.push(`Password must be at most ${policy.maxLength} characters long.`);
  }
  for (const check of checks) {
    if (!check.passed && check.name !== 'length') errors.push(check.hint);
  }
  const common = EXCLUDED_PASSWORD_SUBSTRINGS.find((s) =>
    password.toLowerCase().includes(s.toLowerCase())
  );
  if (common) errors.push(`Password contains a predictable substring ("${common}").`);

  return {
    valid: errors.length === 0,
    errors,
    score: computeScore(password, policy.minLength, checks),
  };
}

/**
 * Computes a 0-100 strength score used by the password strength meter UI.
 */
function computeScore(
  password: string,
  minLength: number,
  checks: PasswordCheck[]
): PasswordScore {
  const entropy = password.length * Math.log2(94);
  const charClassBonus = checks.filter((c) => c.passed).length / 5; // 5 classes beyond length

  let score = Math.round(Math.min(100, (entropy / (minLength * 6.55)) * 100));
  score = Math.round(score * 0.7 + charClassBonus * 100 * 0.3);

  // Long common-adjacent passwords still get penalized
  const lower = password.toLowerCase();
  if (EXCLUDED_PASSWORD_SUBSTRINGS.some((s) => lower.includes(s.toLowerCase()))) {
    score = Math.max(0, score - 40);
  }

  score = Math.max(0, Math.min(100, score));

  const strength: PasswordStrength =
    score < 40 ? 'weak' : score < 60 ? 'fair' : score < 80 ? 'strong' : 'very-strong';

  return { score, strength, checks };
}
