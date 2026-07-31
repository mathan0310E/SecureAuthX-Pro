import type {
  AuthenticatedUser,
  LoginResponseData,
  RegisterResponseData,
  ResendVerificationResponseData,
  VerifyEmailResponseData,
} from '@secureauthx/types';
import type { LoginInput, RegisterInput } from '@/lib/validation/auth';
import { apiFetch } from './client';

export interface MeResponse {
  user: AuthenticatedUser;
}

export interface LogoutResponse {
  revoked: boolean;
  userId: string | null;
}

/**
 * Typed auth endpoints, called through the same-origin `/api` proxy.
 */
export const authApi = {
  register(input: RegisterInput): Promise<RegisterResponseData> {
    return apiFetch<RegisterResponseData>('/api/v1/auth/register', {
      method: 'POST',
      body: input,
    });
  },

  login(input: LoginInput): Promise<LoginResponseData> {
    return apiFetch<LoginResponseData>('/api/v1/auth/login', {
      method: 'POST',
      body: input,
    });
  },

  logout(): Promise<LogoutResponse> {
    return apiFetch<LogoutResponse>('/api/v1/auth/logout', { method: 'POST' });
  },

  verifyEmail(token: string): Promise<VerifyEmailResponseData> {
    return apiFetch<VerifyEmailResponseData>('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token },
    });
  },

  resendVerification(email: string): Promise<ResendVerificationResponseData> {
    return apiFetch<ResendVerificationResponseData>(
      '/api/v1/auth/resend-verification',
      { method: 'POST', body: { email } }
    );
  },

  me(): Promise<MeResponse> {
    return apiFetch<MeResponse>('/api/v1/auth/me');
  },
};
