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

  /**
   * Keepalive: run a trivial query every minute so the isolate stays resident
   * and its pooled pg connection stays warm. Without this, every user request
   * on a cold isolate pays the full TCP+TLS+SCRAM handshake to Neon (~2s),
   * and a stalled handshake is what the runtime kills as an 1101 "script will
   * never generate a response". A warm connection drops latency to ~300ms.
   */
  async scheduled(
    _controller: { scheduledTime: number; cron: string },
    bindings: Record<string, string | undefined>
  ): Promise<void> {
    const { setEnvSource } = await import('./config/env');
    setEnvSource(bindings);

    const { prisma } = await import('./config/prisma');
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      console.error('keepalive: database ping failed', err);
    }
  },
};
