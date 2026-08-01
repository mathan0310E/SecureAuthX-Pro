import { parseEnv, type Env } from '@secureauthx/config';

let source: Record<string, string | undefined> | undefined;
let cached: Env | null = null;

/**
 * Points the environment resolver at an explicit source. Used by the
 * Cloudflare Worker entry to inject bindings before any `env` access —
 * `node:fs`/dotenv never runs on the edge.
 */
export function setEnvSource(s: Record<string, string | undefined>): void {
  cached = null;
  source = s;
}

/**
 * Loads and validates the environment once. On Node the source is
 * `process.env` (already populated by `config/dotenv`); on Workers it is the
 * binding map supplied via `setEnvSource`. Throws with actionable details
 * when configuration is invalid.
 */
export function loadEnv(): Env {
  if (cached) return cached;

  const { env, warnings } = parseEnv(source ?? process.env);
  for (const warning of warnings) {
    console.warn(`[env] ${warning}`);
  }

  cached = env;
  return env;
}

/**
 * Lazily-resolved environment proxy. Property access triggers `loadEnv()` on
 * first use, so the same module works on Node (reads `process.env`) and on
 * Workers (reads bindings set before the first request). Consumers keep using
 * `import { env } from '../config/env'` unchanged.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    return (loadEnv() as unknown as Record<PropertyKey, unknown>)[prop];
  },
  has(_target, prop) {
    return prop in (loadEnv() as unknown as object);
  },
});
