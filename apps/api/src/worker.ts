/**
 * Cloudflare Worker entry. Kept tiny and dependency-free so nothing that
 * touches `env` at import time (config/prisma, config/cache) evaluates before
 * the binding source is injected via `setEnvSource`.
 */
export default {
  async fetch(
    request: Request,
    bindings: Record<string, string | undefined>
  ): Promise<Response> {
    const { setEnvSource } = await import('./config/env');
    setEnvSource(bindings);

    const { getWorkerApp } = await import('./worker-app');
    return getWorkerApp().fetch(request);
  },
};
