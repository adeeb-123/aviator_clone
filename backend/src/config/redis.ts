import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Redis is used for (a) the Socket.io adapter (horizontal scaling) and (b)
 * caching leaderboards / hot data. For local development without a Redis server,
 * set REDIS_DISABLED=true: the adapter is skipped and an in-memory Map backs the
 * cache so the app runs with zero external dependencies.
 */

let available = false;

export const redis: Redis | null = env.redisDisabled
  ? null
  : new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
    });

redis?.on('error', (err) => logger.error({ err: err.message }, 'Redis error'));
redis?.on('connect', () => logger.info('Redis connected'));

export function isRedisAvailable(): boolean {
  return available;
}

export async function connectRedis(): Promise<void> {
  if (!redis) {
    logger.warn('Redis disabled — using in-memory cache (no horizontal scaling)');
    return;
  }
  try {
    if (redis.status === 'wait' || redis.status === 'end') {
      await redis.connect();
    }
    available = true;
  } catch (err) {
    available = false;
    logger.warn({ err: (err as Error).message }, 'Redis unavailable — falling back to in-memory cache');
  }
}

// ── In-memory cache fallback ─────────────────────────────────
interface CacheEntry {
  value: string;
  expiresAt: number;
}
const memCache = new Map<string, CacheEntry>();

export async function cacheSet(key: string, value: unknown, ttlSec = 30): Promise<void> {
  const payload = JSON.stringify(value);
  if (redis && available) {
    await redis.set(key, payload, 'EX', ttlSec);
    return;
  }
  memCache.set(key, { value: payload, expiresAt: Date.now() + ttlSec * 1000 });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis && available) {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memCache.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}
