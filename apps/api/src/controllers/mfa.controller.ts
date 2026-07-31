import type { Request, Response } from 'express';
import { asyncHandler } from '@secureauthx/shared';
import type { MfaLoginCompletion } from '../services/auth.service';
import { ok } from '../utils/response';
import {
  clearMfaChallengeCookie,
  setAuthCookies,
  setTrustedDeviceCookie,
} from '../utils/cookies';
import { env } from '../config/env';

function completeMfaAuthFlow(
  req: Request,
  res: Response,
  code: string,
  message: string,
  data: MfaLoginCompletion
): void {
  clearMfaChallengeCookie(res);
  setAuthCookies(res, data.tokens, env.JWT_ACCESS_TTL, data.tokens.expiresIn);
  if (data.deviceToken) {
    setTrustedDeviceCookie(res, data.deviceToken, env.TRUSTED_DEVICE_TTL_DAYS * 86400);
  }
  ok(req, res, code, message, data);
}

/**
 * MFA endpoints — login-step completion (pre-session) and authenticated
 * enrollment/settings (all others).
 */
export const mfaController = {
  // -------------------------------------------------------------------------
  // Login completion (challenge-gated)
  // -------------------------------------------------------------------------

  verifyTotp: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.auth.completeMfaTotp(req.body, req);
    completeMfaAuthFlow(req, res, 'MFA_VERIFIED', 'Authentication code accepted.', data);
  }),

  verifyRecovery: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.auth.completeMfaRecovery(req.body, req);
    completeMfaAuthFlow(req, res, 'MFA_VERIFIED', 'Recovery code accepted.', data);
  }),

  beginWebAuthnVerify: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.auth.beginWebAuthnMfaLogin(req.body.challengeId);
    ok(req, res, 'WEBAUTHN_CHALLENGE_READY', 'Security key challenge ready.', data);
  }),

  verifyWebAuthn: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.auth.completeWebAuthnMfa(req.body, req);
    completeMfaAuthFlow(req, res, 'MFA_VERIFIED', 'Security key accepted.', data);
  }),

  // -------------------------------------------------------------------------
  // Status & settings (authenticated)
  // -------------------------------------------------------------------------

  status: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.mfa.getStatus(req.user!.id);
    ok(req, res, 'MFA_STATUS', 'MFA status.', data);
  }),

  startTotp: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.mfa.beginTotpEnrollment(req.user!.id);
    ok(req, res, 'TOTP_SETUP_STARTED', 'Scan the QR code with your authenticator app.', data);
  }),

  verifyTotpEnrollment: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.mfa.completeTotpEnrollment(req.user!.id, req.body.code, req);
    ok(req, res, 'TOTP_ENABLED', 'Authenticator app enabled. Store your recovery codes.', data);
  }),

  startWebAuthn: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.mfa.beginWebAuthnRegistration(req.user!.id);
    ok(req, res, 'WEBAUTHN_SETUP_STARTED', 'Security key registration started.', data);
  }),

  verifyWebAuthnEnrollment: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.mfa.completeWebAuthnRegistration(
      req.body.challengeId,
      req.user!.id,
      req.body.deviceName ?? '',
      req.body.registration,
      req
    );
    ok(req, res, 'WEBAUTHN_ENABLED', 'Security key registered. Store your recovery codes.', data);
  }),

  regenerateRecoveryCodes: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.mfa.regenerateRecoveryCodesWithPassword(
      req.user!.id,
      req.body.password,
      req
    );
    ok(req, res, 'RECOVERY_CODES_REGENERATED', 'New recovery codes generated.', data);
  }),

  removeWebAuthn: asyncHandler(async (req: Request, res: Response) => {
    await req.container!.mfa.removeWebAuthnCredential(req.user!.id, req.body.credentialId, req);
    ok(req, res, 'WEBAUTHN_REMOVED', 'Security key removed.', { removed: true });
  }),

  disable: asyncHandler(async (req: Request, res: Response) => {
    await req.container!.mfa.disable(req.user!.id, req.body.password, req);
    clearMfaChallengeCookie(res);
    ok(req, res, 'MFA_DISABLED', 'Multi-factor authentication has been disabled.', { disabled: true });
  }),
};
