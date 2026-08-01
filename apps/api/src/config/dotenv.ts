import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Node-only bootstrap: locates the repository-root `.env` by walking upward
 * from the current working directory and loads it into `process.env`.
 * Existing environment variables (e.g. injected by Docker) take precedence.
 *
 * This module is intentionally NOT imported by the Cloudflare Worker entry —
 * the edge build never touches `node:fs`.
 */
export function loadRootDotenv(): void {
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
