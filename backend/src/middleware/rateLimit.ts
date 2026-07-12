import rateLimit, { Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis';

// Don't rate-limit the test suite (it fires many auth calls from one IP).
const skip = () => process.env.NODE_ENV === 'test';

/**
 * When Redis is enabled, back the limiters with it so counters are shared across
 * every instance (in-memory counters reset per-process and can be bypassed by
 * hitting different replicas). `passOnStoreError` keeps the app up if Redis blips —
 * a request is allowed through rather than 500ing the whole site.
 */
function makeStore(prefix: string): Store | undefined {
  if (!redis) return undefined; // REDIS_DISABLED -> default in-memory store
  const client = redis;
  return new RedisStore({
    // ioredis: forward the raw command; the cast bridges client/lib reply types.
    sendCommand: (...args: string[]) => (client.call as (...a: string[]) => Promise<unknown>)(...args),
    prefix,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as unknown as Store;
}

/** Global: 100 requests / minute / IP. */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: makeStore('rl:global:'),
  skip,
  message: { error: 'Too many requests, slow down.' },
});

/** Stricter limiter for auth endpoints to deter brute-force. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: makeStore('rl:auth:'),
  skip,
  message: { error: 'Too many authentication attempts. Try again later.' },
});

/** Registration limiter — curbs mass multi-account / bonus farming from one IP. */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.MAX_REGISTRATIONS_PER_HOUR ?? '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: makeStore('rl:register:'),
  skip,
  message: { error: 'Too many accounts created from this network. Try again later.' },
});
