import type { MfaLoginCompletion } from '../services/auth.service';
import { ok } from '../utils/response';
import {
  clearMfaChallengeCookie,
  setAuthCookies,
  setTrustedDeviceCookie,
} from '../utils/cookies';
import { env } from '../config/env';
import { toRequestContext } from '../utils/request-context';
import type { AppContext } from '../types/context';

function completeMfaAuthFlow(
  c: AppContext,
  code: string,
  message: string,
  data: MfaLoginCompletion
): Response {
  clearMfaChallengeCookie(c);
  setAuthCookies(c, data.tokens, env.JWT_ACCESS_TTL, data.tokens.expiresIn);
  if (data.deviceToken) {
    setTrustedDeviceCookie(c, data.deviceToken, env.TRUSTED_DEVICE_TTL_DAYS * 86400);
  }
  return ok(c, code, message, data);
}

/**
 * MFA endpoints — login-step completion (pre-session) and authenticated
 * enrollment/settings (all others).
 */
export const mfaController = {
  // -------------------------------------------------------------------------
  // Login completion (challenge-gated)
  // -------------------------------------------------------------------------

  verifyTotp: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c.get('container').auth.completeMfaTotp(body, toRequestContext(c));
    return completeMfaAuthFlow(c, 'MFA_VERIFIED', 'Authentication code accepted.', data);
  },

  verifyRecovery: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c.get('container').auth.completeMfaRecovery(body, toRequestContext(c));
    return completeMfaAuthFlow(c, 'MFA_VERIFIED', 'Recovery code accepted.', data);
  },

  beginWebAuthnVerify: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c.get('container').auth.beginWebAuthnMfaLogin(body.challengeId);
    return ok(c, 'WEBAUTHN_CHALLENGE_READY', 'Security key challenge ready.', data);
  },

  verifyWebAuthn: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c.get('container').auth.completeWebAuthnMfa(body, toRequestContext(c));
    return completeMfaAuthFlow(c, 'MFA_VERIFIED', 'Security key accepted.', data);
  },

  // -------------------------------------------------------------------------
  // Status & settings (authenticated)
  // -------------------------------------------------------------------------

  status: async (c: AppContext) => {
    const data = await c.get('container').mfa.getStatus(c.get('user')!.id);
    return ok(c, 'MFA_STATUS', 'MFA status.', data);
  },

  startTotp: async (c: AppContext) => {
    const data = await c.get('container').mfa.beginTotpEnrollment(c.get('user')!.id);
    return ok(c, 'TOTP_SETUP_STARTED', 'Scan the QR code with your authenticator app.', data);
  },

  verifyTotpEnrollment: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c
      .get('container')
      .mfa.completeTotpEnrollment(c.get('user')!.id, body.code, toRequestContext(c));
    return ok(c, 'TOTP_ENABLED', 'Authenticator app enabled. Store your recovery codes.', data);
  },

  startWebAuthn: async (c: AppContext) => {
    const data = await c.get('container').mfa.beginWebAuthnRegistration(c.get('user')!.id);
    return ok(c, 'WEBAUTHN_SETUP_STARTED', 'Security key registration started.', data);
  },

  verifyWebAuthnEnrollment: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c.get('container').mfa.completeWebAuthnRegistration(
      body.challengeId,
      c.get('user')!.id,
      body.deviceName ?? '',
      body.registration,
      toRequestContext(c)
    );
    return ok(c, 'WEBAUTHN_ENABLED', 'Security key registered. Store your recovery codes.', data);
  },

  regenerateRecoveryCodes: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c.get('container').mfa.regenerateRecoveryCodesWithPassword(
      c.get('user')!.id,
      body.password,
      toRequestContext(c)
    );
    return ok(c, 'RECOVERY_CODES_REGENERATED', 'New recovery codes generated.', data);
  },

  removeWebAuthn: async (c: AppContext) => {
    const body = await c.req.json();
    await c
      .get('container')
      .mfa.removeWebAuthnCredential(c.get('user')!.id, body.credentialId, toRequestContext(c));
    return ok(c, 'WEBAUTHN_REMOVED', 'Security key removed.', { removed: true });
  },

  disable: async (c: AppContext) => {
    const body = await c.req.json();
    await c.get('container').mfa.disable(c.get('user')!.id, body.password, toRequestContext(c));
    clearMfaChallengeCookie(c);
    return ok(c, 'MFA_DISABLED', 'Multi-factor authentication has been disabled.', { disabled: true });
  },
};
