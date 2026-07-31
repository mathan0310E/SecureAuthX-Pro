import Redis from 'ioredis';
import { env } from './env';

/**
 * Shared Redis connection for caching, rate limiting, and session
 * bookkeeping. Retries lazily so a transient Redis outage never
 * prevents the API from booting.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  lazyConnect: true,
});

redis.on('error', (err) => {
  // Logged once; ioredis will keep retrying per retryStrategy.
  console.error(`[redis] connection error: ${err.message}`);
});

export async function pingRedis(): Promise<boolean> {
  try {
    if (redis.status !== 'ready') {
      await redis.connect();
    }
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redis.status !== 'end') {
    await redis.disconnect();
  }
}
