import { handle } from 'hono/vercel';
import { createPrismaPgClient } from '@secureauthx/database';
import { createApp } from '../src/app';
import { buildContainer, type AppContainer } from '../src/config/container';
import { cache } from '../src/config/cache';
import { env } from '../src/config/env';

/**
 * Vercel serverless entry point (Node runtime).
 *
 * Every `/api/*` request is routed here by the `api/[[...slug]].ts` catch-all
 * and dispatched through the same Hono application used by the local Node
 * server (`src/index.ts`). The Prisma client is bound to the pure-JS pg
 * adapter so no native query-engine binary is required inside the function.
 */
let container: AppContainer | undefined;

function getContainer(): AppContainer {
  if (!container) {
    container = buildContainer(createPrismaPgClient(env, env.DATABASE_URL), cache);
  }
  return container;
}

const app = createApp(getContainer());

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
