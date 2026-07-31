import validator from 'validator';
import { isUuid } from '@secureauthx/shared';

/**
 * Input sanitization + validation helpers.
 * Sanitizers are applied defensively at the API boundary; authoritative
 * validation happens in the validation layer (Zod).
 */

export function sanitizeEmail(value: string): string {
  return validator.normalizeEmail(validator.trim(value).toLowerCase(), {
    all_lowercase: true,
    gmail_remove_dots: false,
  }) as string;
}

export function escapeHtml(value: string): string {
  return validator.escape(value);
}

export function stripTags(value: string): string {
  return validator.stripLow(validator.trim(value));
}

export function trimAll(value: string): string {
  return validator.trim(value);
}

export function validateUuid(value: string): boolean {
  return isUuid(value);
}

export function validateEmail(value: string): boolean {
  return validator.isEmail(value);
}

export function isValidIp(value: string): boolean {
  return validator.isIP(value, 4) || validator.isIP(value, 6);
}

/**
 * Sanitizes an unknown body recursively: trims strings, removes HTML,
 * and drops keys that are not in the allowed whitelist.
 */
export function sanitizeBody<T extends Record<string, unknown>>(
  body: unknown,
  allowedKeys: string[]
): T {
  const source = (body ?? {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    const raw = source[key];
    if (raw === undefined) continue;
    if (typeof raw === 'string') {
      result[key] = stripTags(raw);
    } else if (Array.isArray(raw)) {
      result[key] = raw.map((item) =>
        typeof item === 'string' ? stripTags(item) : item
      );
    } else {
      result[key] = raw;
    }
  }

  return result as T;
}
