import { Router } from 'express';
import { v1Router } from './v1';
import { apiRateLimiter } from '../middlewares/security';

/**
 * Top-level API router. Versioning lives in the path (/api/v1).
 */
export const apiRouter = Router();

apiRouter.use(apiRateLimiter);
apiRouter.use('/v1', v1Router);
