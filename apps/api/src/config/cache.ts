import { Redis } from '@upstash/redis';
import { env } from './env';

/**
 * Tiny cache abstraction used for MFA challenge/ceremony state, rate limiting,
 * and the readiness probe. Two backends:
 *  - `UpstashCache` — HTTP REST Redis, works on Cloudflare Workers and Node.
 *  - `MemoryCache` — per-isolate fallback when no Upstash endpoint is set.
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

class MemoryCache implements Cache {
  private readonly store = new Map<string, { value: unknown; expiresAt: number | null }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt !== null && item.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}

class UpstashCache implements Cache {
  constructor(private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, { ex: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // Upstash is connectionless (HTTP); nothing to tear down.
  }
}

/**
 * Builds a cache from an Upstash REST URL. Any other value (or empty string)
 * yields the in-memory fallback so local dev and tests need no Redis.
 */
export function createCache(redisUrl: string, redisToken?: string): Cache {
  if (redisUrl.startsWith('https://')) {
    return new UpstashCache(new Redis({ url: redisUrl, token: redisToken }));
  }
  return new MemoryCache();
}

/** Shared cache instance for the running process/isolate. */
export const cache: Cache = createCache(env.REDIS_URL, env.REDIS_TOKEN || undefined);

/** Readiness probe helper used by the health endpoint. */
export async function pingCache(): Promise<boolean> {
  return cache.ping();
}
