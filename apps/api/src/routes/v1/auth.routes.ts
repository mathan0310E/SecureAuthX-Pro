import { Hono } from 'hono';
import { createAuthRateLimiter } from '@secureauthx/security';
import {
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from '@secureauthx/validation';
import type { AppContainer } from '../../config/container';
import { env } from '../../config/env';
import { createBoundAuthMiddleware } from '../../middlewares/bound-auth';
import { requireCsrf } from '../../middlewares/csrf';
import { validate } from '../../middlewares/validate';
import { authController } from '../../controllers/auth.controller';
import type { AppEnv } from '../../types/context';

/**
 * /api/v1/auth — registration, authentication, and session refresh.
 */
export function createAuthRouter(container: AppContainer): Hono<AppEnv> {
  const router = new Hono<AppEnv>();
  const authRequired = createBoundAuthMiddleware(container);
  const authLimiter = createAuthRateLimiter({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX,
  });

  router.post(
    '/register',
    authLimiter,
    validate({ body: registerSchema }),
    authController.register
  );

  router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);

  router.post('/refresh', requireCsrf, authController.refresh);

  router.post(
    '/verify-email',
    authLimiter,
    validate({ body: verifyEmailSchema }),
    authController.verifyEmail
  );

  router.post(
    '/resend-verification',
    authLimiter,
    validate({ body: resendVerificationSchema }),
    authController.resendVerification
  );

  router.post('/logout', authController.logout);

  router.get('/me', authRequired, authController.me);

  return router;
}
