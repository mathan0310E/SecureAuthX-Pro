import type { NextFunction, Request, Response } from 'express';
import type { AppContainer } from '../config/container';

/**
 * Attaches the service container to every request so controllers can
 * resolve dependencies without importing globals.
 */
export function containerMiddleware(container: AppContainer) {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.container = container;
    next();
  };
}
