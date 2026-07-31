/**
 * Central constants for SecureAuthX Pro.
 * Values here are compile-time defaults; runtime values come from the
 * validated environment (see `env.ts`).
 */

// ---------------------------------------------------------------------------
// Identity & Security
// ---------------------------------------------------------------------------

export const SECURITY = {
  /** OWASP-recommended minimum for modern deployments. */
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_MAX_LENGTH: 128,
  /** Work factor for bcrypt. 12 is the 2024+ baseline. */
  BCRYPT_ROUNDS: 12,
  /** Maximum failed attempts before the account locks. */
  LOGIN_MAX_ATTEMPTS: 5,
  /** How long a lockout lasts, in minutes. */
  LOGIN_LOCKOUT_MINUTES: 15,
  /** Max trusted devices registered per user. */
  MAX_DEVICES_PER_USER: 10,
} as const;

export const TOKEN_TTL = {
  /** JWT access token lifetime in seconds (15 min). */
  ACCESS: 900,
  /** JWT refresh token lifetime in seconds (7 days). */
  REFRESH: 604800,
  /** Email verification token lifetime in seconds (24 h). */
  EMAIL_VERIFICATION: 86400,
  /** Password reset token lifetime in seconds (15 min). */
  PASSWORD_RESET: 900,
  /** Session idle timeout in seconds (30 min). */
  SESSION_IDLE: 1800,
  /** Absolute session lifetime in seconds (60 min). */
  SESSION_ABSOLUTE: 3600,
} as const;

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'sax_access_token',
  REFRESH_TOKEN: 'sax_refresh_token',
  CSRF: 'sax_csrf',
} as const;

// ---------------------------------------------------------------------------
// Audit & Events
// ---------------------------------------------------------------------------

export const AUDIT_ACTION = {
  // Auth lifecycle
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILED: 'auth.login_failed',
  LOGIN_LOCKED: 'auth.login_locked',
  LOGOUT: 'auth.logout',
  REFRESH_TOKEN_ROTATED: 'auth.refresh_rotated',
  TOKEN_REUSE_DETECTED: 'auth.token_reuse',
  // Account
  EMAIL_VERIFIED: 'account.email_verified',
  EMAIL_VERIFICATION_SENT: 'account.email_verification_sent',
  EMAIL_VERIFICATION_RESENT: 'account.email_verification_resent',
  PASSWORD_CHANGED: 'account.password_changed',
  PASSWORD_RESET_REQUESTED: 'account.password_reset_requested',
  PASSWORD_RESET: 'account.password_reset',
  PROFILE_UPDATED: 'account.profile_updated',
  // 2FA
  TOTP_ENABLED: 'mfa.totp_enabled',
  TOTP_DISABLED: 'mfa.totp_disabled',
  WEBAUTHN_REGISTERED: 'mfa.webauthn_registered',
  WEBAUTHN_REMOVED: 'mfa.webauthn_removed',
  RECOVERY_CODES_GENERATED: 'mfa.recovery_codes_generated',
  // Devices & Sessions
  DEVICE_TRUSTED: 'device.trusted',
  DEVICE_REVOKED: 'device.revoked',
  SESSION_REVOKED: 'session.revoked',
  SESSION_EXPIRED: 'session.expired',
  // Admin
  ADMIN_USER_ROLE_CHANGED: 'admin.user_role_changed',
  ADMIN_USER_DEACTIVATED: 'admin.user_deactivated',
  ADMIN_USER_ACTIVATED: 'admin.user_activated',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export const SECURITY_EVENT_TYPE = {
  BRUTE_FORCE: 'brute_force_attempt',
  UNUSUAL_LOCATION: 'unusual_location',
  UNUSUAL_DEVICE: 'unusual_device',
  NEW_DEVICE_LOGIN: 'new_device_login',
  REFRESH_TOKEN_REUSE: 'refresh_token_reuse',
  ACCOUNT_LOCKED: 'account_locked',
  ACCOUNT_UNLOCKED: 'account_unlocked',
  PASSWORD_CHANGE: 'password_change',
  EMAIL_CHANGE: 'email_change',
  MFA_CHANGE: 'mfa_change',
} as const;

export type SecurityEventType =
  (typeof SECURITY_EVENT_TYPE)[keyof typeof SECURITY_EVENT_TYPE];

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const EXCLUDED_PASSWORD_SUBSTRINGS = ['secureauthx', 'password', '123456'] as const;
