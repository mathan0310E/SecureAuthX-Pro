/**
 * Authentication-related type contracts shared between API and Web.
 */

export type UserRole = 'USER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'PENDING_VERIFICATION';
export type DeviceTrustLevel = 'NONE' | 'TRUSTED' | 'UNTRUSTED';
export type SessionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';
export type AuditSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  sessionId: string;
  type: 'access';
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
  /** Random per-token nonce so two tokens for the same session never collide. */
  nonce: string;
  type: 'refresh';
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/** Public user shape returned from auth endpoints. */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface RegisterResponseData {
  email: string;
  requiresEmailVerification: boolean;
}

export interface LoginResponseData {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshResponseData {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface VerifyEmailResponseData {
  email: string;
  verified: boolean;
}

export interface ResendVerificationResponseData {
  email: string;
  sent: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

export interface SessionInfo {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  deviceName: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  current: boolean;
}
