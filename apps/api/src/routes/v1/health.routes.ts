import { Router } from 'express';
import { healthController } from '../../controllers/health.controller';

export const healthRouter = Router();

/**
 * GET /health — liveness & readiness probe.
 */
healthRouter.get('/', healthController.check);
