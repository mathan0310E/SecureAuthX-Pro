/**
 * Cloudflare Worker entry. Kept tiny and dependency-free so nothing that
 * touches `env` at import time (config/prisma, config/cache) evaluates before
 * the binding source is injected via `setEnvSource`.
 */

type Bindings = Record<string, string | undefined>;

interface HyperdriveBinding {
  connectionString: string;
}

/**
 * Applies binding-level overrides before env resolution:
 * - If a Hyperdrive binding is present, its pooled connection string wins over
 *   DATABASE_URL. Hyperdrive keeps DB connections warm at the edge, removing
 *   per-isolate Neon handshakes and pooler pressure entirely.
 * No-op when the binding is absent, so the same code runs against a plain
 * DATABASE_URL (local dev, CI, pre-Hyperdrive deploys).
 */
function applyBindingOverrides(bindings: Bindings): void {
  const hyperdrive = (bindings as Record<string, HyperdriveBinding | undefined>).HYPERDRIVE;
  if (hyperdrive && typeof hyperdrive.connectionString === 'string') {
    bindings.DATABASE_URL = hyperdrive.connectionString;
  }
}

export default {
  async fetch(request: Request, bindings: Bindings): Promise<Response> {
    applyBindingOverrides(bindings);
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
    bindings: Bindings
  ): Promise<void> {
    applyBindingOverrides(bindings);
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
