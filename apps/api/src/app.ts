import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { env } from './config/env';
import { configureSecurity } from './middlewares/security';
import { requestIdMiddleware } from './middlewares/request-id';
import { httpLogger } from './middlewares/http-logger';
import { containerMiddleware } from './middlewares/container';
import { errorHandler } from './middlewares/error-handler';
import { notFoundHandler } from './middlewares/not-found';
import { createApiRouter } from './routes';
import { createHealthRouter } from './routes/v1/health.routes';
import { AppError } from './utils/errors';
import type { AppContainer } from './config/container';
import type { AppEnv } from './types/context';

/**
 * Composes the Hono application. Exported as a factory so tests can
 * create isolated instances with a mocked container.
 */
export function createApp(container: AppContainer): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requestIdMiddleware);
  app.use('*', httpLogger);
  app.use('*', containerMiddleware(container));

  configureSecurity(app);

  app.use(
    '*',
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: () => {
        throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large.');
      },
    })
  );

  app.route('/health', createHealthRouter());
  app.route('/api', createApiRouter(container));

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
