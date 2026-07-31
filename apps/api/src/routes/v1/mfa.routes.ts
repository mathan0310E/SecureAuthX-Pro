import { Router } from 'express';
import { createAuthRateLimiter } from '@secureauthx/security';
import {
  disableMfaSchema,
  mfaVerifyRecoverySchema,
  mfaVerifyTotpSchema,
  mfaVerifyWebAuthnSchema,
  regenerateRecoveryCodesSchema,
  removeWebAuthnSchema,
  totpEnrollVerifySchema,
  webauthnEnrollStartSchema,
  webauthnEnrollVerifySchema,
} from '@secureauthx/validation';
import type { AppContainer } from '../../config/container';
import { env } from '../../config/env';
import { createBoundAuthMiddleware } from '../../middlewares/bound-auth';
import { createRequireMfaChallengeMiddleware } from '../../middlewares/require-mfa-challenge';
import { validate } from '../../middlewares/validate';
import { mfaController } from '../../controllers/mfa.controller';

/**
 * /api/v1/mfa — second-factor verification (login) and enrollment/settings.
 */
export function createMfaRouter(container: AppContainer): Router {
  const router = Router();
  const authRequired = createBoundAuthMiddleware(container);
  const mfaChallenge = createRequireMfaChallengeMiddleware(container);
  const mfaLimiter = createAuthRateLimiter({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX,
  });

  // Login completion — guarded by the challenge cookie, rate-limited.
  router.post('/verify/totp', mfaLimiter, mfaChallenge, validate({ body: mfaVerifyTotpSchema }), mfaController.verifyTotp);
  router.post('/verify/recovery', mfaLimiter, mfaChallenge, validate({ body: mfaVerifyRecoverySchema }), mfaController.verifyRecovery);
  router.post('/verify/webauthn/start', mfaLimiter, mfaChallenge, validate({ body: mfaVerifyWebAuthnSchema.pick({ challengeId: true }) }), mfaController.beginWebAuthnVerify);
  router.post('/verify/webauthn', mfaLimiter, mfaChallenge, validate({ body: mfaVerifyWebAuthnSchema }), mfaController.verifyWebAuthn);

  // Status & settings — authenticated.
  router.get('/status', authRequired, mfaController.status);

  router.post('/totp/start', authRequired, mfaController.startTotp);
  router.post('/totp/verify', authRequired, validate({ body: totpEnrollVerifySchema }), mfaController.verifyTotpEnrollment);

  router.post('/webauthn/start', authRequired, validate({ body: webauthnEnrollStartSchema }), mfaController.startWebAuthn);
  router.post('/webauthn/verify', authRequired, validate({ body: webauthnEnrollVerifySchema }), mfaController.verifyWebAuthnEnrollment);
  router.post('/webauthn/remove', authRequired, validate({ body: removeWebAuthnSchema }), mfaController.removeWebAuthn);

  router.post('/recovery/regenerate', authRequired, validate({ body: regenerateRecoveryCodesSchema }), mfaController.regenerateRecoveryCodes);

  router.post('/disable', authRequired, validate({ body: disableMfaSchema }), mfaController.disable);

  return router;
}
