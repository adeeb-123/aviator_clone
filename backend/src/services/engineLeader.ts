import { redis, isRedisAvailable } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Distributed single-engine guard. Only ONE process may run the authoritative
 * game loop — two concurrent engines corrupt the game (duplicate rounds, phase
 * clashes). A short-lived Redis lease with a heartbeat elects a single leader;
 * other instances serve HTTP/socket only and relay round events via the Redis
 * adapter. Without Redis it falls back to starting directly (single-instance).
 */
const KEY = 'aviator:engine:leader';
const TTL_MS = 15000;
const RENEW_MS = 5000;
let timer: NodeJS.Timeout | null = null;
let leading = false;

export async function ensureSingleEngine(instanceId: string, engine: { start: () => void; stop: () => void }): Promise<void> {
  if (!redis || !isRedisAvailable()) {
    logger.warn('No Redis — starting engine without a distributed lock (run only ONE backend instance!)');
    engine.start();
    return;
  }
  const client = redis;

  const tick = async () => {
    try {
      if (leading) {
        const owner = await client.get(KEY);
        if (owner === instanceId) {
          await client.set(KEY, instanceId, 'PX', TTL_MS, 'XX'); // renew our lease
        } else {
          leading = false;
          logger.warn('Lost engine leadership — stopping local game loop');
          engine.stop();
        }
      } else {
        const ok = await client.set(KEY, instanceId, 'PX', TTL_MS, 'NX');
        if (ok) {
          leading = true;
          logger.info({ instanceId }, '👑 Acquired engine leadership — starting game loop');
          engine.start();
        } else {
          logger.info('Another instance owns the engine — this process serves requests only');
        }
      }
    } catch (err) {
      logger.warn({ err }, 'engine leadership tick failed');
    }
  };

  await tick();
  timer = setInterval(tick, RENEW_MS);
  timer.unref?.();
}

export async function releaseEngineLeadership(instanceId: string): Promise<void> {
  if (timer) { clearInterval(timer); timer = null; }
  if (leading && redis && isRedisAvailable()) {
    try { if ((await redis.get(KEY)) === instanceId) await redis.del(KEY); } catch { /* ignore */ }
  }
  leading = false;
}
