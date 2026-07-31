import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Local integration tests hit the live rate limiters by IP; raise the
    // ceilings so a test run (or two) does not trip them.
    env: {
      AUTH_RATE_LIMIT_MAX: '10000',
      RATE_LIMIT_MAX: '100000',
      NODE_ENV: 'test',
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
