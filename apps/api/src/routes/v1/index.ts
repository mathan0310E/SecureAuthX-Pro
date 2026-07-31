import { Router } from 'express';
import { healthRouter } from './health.routes';

/**
 * Version 1 API router.
 * Feature routers (auth, users, mfa, admin, ...) mount here in later phases.
 */
export const v1Router = Router();

v1Router.use('/health', healthRouter);
