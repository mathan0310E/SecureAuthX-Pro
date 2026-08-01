import { Hono } from 'hono';
import { buildContainer } from './config/container';
import { createApp } from './app';
import { prisma } from './config/prisma';
import { cache } from './config/cache';
import type { AppEnv } from './types/context';

let app: Hono<AppEnv> | null = null;

/**
 * Lazily composes the Worker app on the first request. Built inside a fetch
 * call so `setEnvSource(bindings)` has already populated the env before any
 * import-time `env` reads (config/prisma, config/cache) execute.
 */
export function getWorkerApp(): Hono<AppEnv> {
  app ??= createApp(buildContainer(prisma, cache));
  return app;
}
