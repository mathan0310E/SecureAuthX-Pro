import type {
  AuthTokens,
  AuthUser,
  MfaLoginChallenge,
  MfaStatus,
  MfaMethod,
} from '@secureauthx/types';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { apiFetch } from './client';

export interface MfaLoginCompletion {
  user: AuthUser;
  tokens: AuthTokens;
  deviceToken: string | null;
}

export interface TotpEnrollment {
  secret: string;
  otpauthUrl: string;
}

export interface WebAuthnRegistrationSession {
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

/**
 * Multi-factor endpoints, called through the same-origin `/api` proxy.
 */
export const mfaApi = {
  verifyTotp(input: {
    challengeId: string;
    code: string;
    rememberDevice: boolean;
  }): Promise<MfaLoginCompletion> {
    return apiFetch<MfaLoginCompletion>('/api/v1/mfa/verify/totp', {
      method: 'POST',
      body: input,
    });
  },

  verifyRecovery(input: {
    challengeId: string;
    code: string;
  }): Promise<MfaLoginCompletion> {
    return apiFetch<MfaLoginCompletion>('/api/v1/mfa/verify/recovery', {
      method: 'POST',
      body: input,
    });
  },

  async beginWebAuthnVerify(challengeId: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const { options } = await apiFetch<{ options: PublicKeyCredentialRequestOptionsJSON }>(
      '/api/v1/mfa/verify/webauthn/start',
      { method: 'POST', body: { challengeId } }
    );
    return options;
  },

  verifyWebAuthn(input: {
    challengeId: string;
    credential: AuthenticationResponseJSON;
    rememberDevice: boolean;
  }): Promise<MfaLoginCompletion> {
    return apiFetch<MfaLoginCompletion>('/api/v1/mfa/verify/webauthn', {
      method: 'POST',
      body: input,
    });
  },

  // -------------------------------------------------------------------------
  // Enrollment & settings
  // -------------------------------------------------------------------------

  status(): Promise<MfaStatus> {
    return apiFetch<MfaStatus>('/api/v1/mfa/status');
  },

  startTotpEnrollment(): Promise<TotpEnrollment> {
    return apiFetch<TotpEnrollment>('/api/v1/mfa/totp/start', { method: 'POST', body: {} });
  },

  verifyTotpEnrollment(code: string): Promise<string[]> {
    return apiFetch<string[]>('/api/v1/mfa/totp/verify', {
      method: 'POST',
      body: { code },
    });
  },

  startWebAuthnEnrollment(): Promise<WebAuthnRegistrationSession> {
    return apiFetch<WebAuthnRegistrationSession>('/api/v1/mfa/webauthn/start', {
      method: 'POST',
      body: {},
    });
  },

  verifyWebAuthnEnrollment(input: {
    challengeId: string;
    deviceName?: string;
    registration: RegistrationResponseJSON;
  }): Promise<string[]> {
    return apiFetch<string[]>('/api/v1/mfa/webauthn/verify', {
      method: 'POST',
      body: input,
    });
  },

  regenerateRecoveryCodes(password: string): Promise<string[]> {
    return apiFetch<string[]>('/api/v1/mfa/recovery/regenerate', {
      method: 'POST',
      body: { password },
    });
  },

  removeWebAuthn(credentialId: string): Promise<{ removed: boolean }> {
    return apiFetch<{ removed: boolean }>('/api/v1/mfa/webauthn/remove', {
      method: 'POST',
      body: { credentialId },
    });
  },

  disableMfa(password: string): Promise<{ disabled: boolean }> {
    return apiFetch<{ disabled: boolean }>('/api/v1/mfa/disable', {
      method: 'POST',
      body: { password },
    });
  },
};

export type { MfaMethod, MfaLoginChallenge };
