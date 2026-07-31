import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { configureSecurity } from './middlewares/security';
import { requestIdMiddleware } from './middlewares/request-id';
import { httpLogger } from './middlewares/http-logger';
import { containerMiddleware } from './middlewares/container';
import { errorHandler } from './middlewares/error-handler';
import { notFoundHandler } from './middlewares/not-found';
import { createApiRouter } from './routes';
import type { AppContainer } from './config/container';

/**
 * Composes the Express application. Exported as a factory so tests can
 * create isolated instances with a mocked container.
 */
export function createApp(container: AppContainer): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  app.use(httpLogger);

  configureSecurity(app);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  app.use(containerMiddleware(container));

  app.use('/api', createApiRouter(container));

  // Liveness probe at the root for plain-Docker healthchecks.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'success', message: 'OK' });
  });

  app.use(notFoundHandler);
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
    errorHandler(err, req, res, next)
  );

  return app;
}

export const listen = (app: Express): void => {
  const port = env.API_PORT;
  const host = env.API_BIND_ADDRESS;
  app.listen(port, host, () => {
    console.log(`[api] ${env.APP_NAME} listening on http://${host}:${port} (${env.NODE_ENV})`);
  });
};
