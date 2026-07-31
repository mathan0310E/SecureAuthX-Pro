import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { parseEnv, type Env } from '@secureauthx/config';

/**
 * Locates the repository-root `.env` by walking upward from the current
 * working directory. Works regardless of whether the process is started
 * from the repo root or a nested workspace folder. Existing environment
 * variables (e.g. injected by Docker) always take precedence.
 */
function loadRootDotenv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

loadRootDotenv();

let cached: Env | null = null;

/**
 * Loads and validates environment variables once per process.
 * Throws with actionable details when configuration is invalid.
 */
export function loadEnv(): Env {
  if (cached) return cached;
  const { env, warnings } = parseEnv(process.env);

  for (const warning of warnings) {
    console.warn(`[env] ${warning}`);
  }

  cached = env;
  return env;
}

export const env = loadEnv();
