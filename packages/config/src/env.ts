import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const numberFromString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? defaultValue : Number(v)))
    .refine((v) => !Number.isNaN(v), { message: 'Must be a valid number' });

const urlFromString = (defaultValue: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? defaultValue : v));

/**
 * Canonical, validated environment schema for SecureAuthX Pro.
 * All processes (API, Web, workers, scripts) validate against this.
 */
export const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('SecureAuthX Pro'),
  APP_DOMAIN: z.string().default('localhost'),
  API_URL: urlFromString('http://localhost:4000'),
  WEB_URL: urlFromString('http://localhost:3000'),

  // API Server
  API_PORT: numberFromString(4000),
  WEB_PORT: numberFromString(3000),
  API_BIND_ADDRESS: z.string().default('0.0.0.0'),
  API_CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  // Database
  POSTGRES_DB: z.string().default('secureauthx'),
  POSTGRES_USER: z.string().default('secureauthx'),
  POSTGRES_PASSWORD: z.string().default('secureauthx'),
  POSTGRES_PORT: numberFromString(5432),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Cache
  REDIS_PORT: numberFromString(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: numberFromString(900),
  JWT_REFRESH_TTL: numberFromString(604800),
  JWT_ISSUER: z.string().default('secureauthx-pro'),
  JWT_AUDIENCE: z.string().default('secureauthx-pro'),

  // Cookies
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: booleanFromString,
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // Security
  BCRYPT_ROUNDS: numberFromString(12),
  PASSWORD_MIN_LENGTH: numberFromString(12),
  PASSWORD_MAX_LENGTH: numberFromString(128),
  LOGIN_MAX_ATTEMPTS: numberFromString(5),
  LOGIN_LOCKOUT_MINUTES: numberFromString(15),
  SESSION_TIMEOUT_MINUTES: numberFromString(60),
  IDLE_TIMEOUT_MINUTES: numberFromString(30),
  MAX_DEVICES_PER_USER: numberFromString(10),

  // Multi-Factor Authentication
  /** Key used to encrypt TOTP secrets at rest (AES-256-GCM, derived via SHA-256). */
  ENCRYPTION_KEY: z
    .string()
    .min(16, 'ENCRYPTION_KEY must be at least 16 characters')
    .default('dev-encryption-key-min-16-chars'),
  /** WebAuthn relying party ID (must match the browser origin host). */
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_RP_NAME: z.string().default('SecureAuthX Pro'),
  /** Origin allowed to complete WebAuthn ceremonies. */
  WEBAUTHN_ORIGIN: z.string().default('http://localhost:3000'),
  /** Lifetime of a pending MFA challenge in seconds. */
  MFA_CHALLENGE_TTL: numberFromString(600),
  /** Number of one-time recovery codes generated per enrollment. */
  RECOVERY_CODES_COUNT: numberFromString(10),
  /** How long a "trust this device" cookie lasts, in days. */
  TRUSTED_DEVICE_TTL_DAYS: numberFromString(30),

  // Email (SMTP)
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: numberFromString(1025),
  SMTP_SECURE: booleanFromString,
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default('SecureAuthX Pro <no-reply@secureauthx.local>'),
  EMAIL_VERIFICATION_TTL: numberFromString(86400),
  PASSWORD_RESET_TTL: numberFromString(900),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: numberFromString(60000),
  RATE_LIMIT_MAX: numberFromString(100),
  AUTH_RATE_LIMIT_MAX: numberFromString(10),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  LOG_DIR: z.string().default('logs'),

  // Bootstrap / Seed
  ADMIN_EMAIL: z.string().email().default('admin@secureauthx.local'),
  ADMIN_NAME: z.string().default('System Administrator'),
  ADMIN_PASSWORD: z.string().min(8).default('change-me-admin-password-123'),
});

export type Env = z.infer<typeof envSchema>;

export interface EnvValidationResult {
  env: Env;
  warnings: string[];
}

/**
 * Validates a raw environment source (typically `process.env`).
 * Returns the parsed environment and collects non-fatal warnings
 * (e.g. the development-only JWT secret fallback).
 */
export function parseEnv(source: Record<string, string | undefined>): EnvValidationResult {
  const warnings: string[] = [];

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (env.JWT_ACCESS_SECRET.startsWith('change-me') || env.JWT_ACCESS_SECRET.startsWith('dev-')) {
      warnings.push('JWT_ACCESS_SECRET appears to be a development/example value.');
    }
    if (env.JWT_REFRESH_SECRET.startsWith('change-me') || env.JWT_REFRESH_SECRET.startsWith('dev-')) {
      warnings.push('JWT_REFRESH_SECRET appears to be a development/example value.');
    }
    if (!env.COOKIE_SECURE) {
      warnings.push('COOKIE_SECURE is false; authentication cookies will be sent over plain HTTP.');
    }
    if (env.ENCRYPTION_KEY.startsWith('dev-')) {
      warnings.push('ENCRYPTION_KEY appears to be a development/example value.');
    }
  }

  return { env, warnings };
}
