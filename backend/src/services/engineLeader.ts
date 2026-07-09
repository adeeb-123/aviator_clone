import { redis } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Single-engine guard.
 *
 * The process that owns the HTTP port runs the game loop — so the engine and the
 * request/snapshot server are ALWAYS the same process (no split-brain). To kill a
 * duplicate loop from an orphaned process (e.g. a ts-node-dev leftover on Windows
 * that released the port but kept its timers running), the newly-started engine
 * publishes a "takeover" claim; any older engine that hears it stands down.
 *
 * Without Redis, the single-port guard alone is relied upon.
 */
const CHANNEL = 'aviator:engine:takeover';
let sub: ReturnType<NonNullable<typeof redis>['duplicate']> | null = null;

export function ensureSingleEngine(instanceId: string, engine: { start: () => void; stop: () => void }): void {
  engine.start();

  if (!redis) {
    logger.warn('No Redis — relying on the single-port guard only (run one backend instance).');
    return;
  }

  // Announce this instance as the live engine; older loops stand down on hearing it.
  redis.publish(CHANNEL, instanceId).catch((err) => logger.warn({ err }, 'engine takeover publish failed'));

  sub = redis.duplicate();
  sub.subscribe(CHANNEL).catch((err) => logger.warn({ err }, 'engine takeover subscribe failed'));
  sub.on('message', (_channel, id) => {
    if (id && id !== instanceId) {
      logger.warn({ newer: id }, 'A newer engine took over — stopping this game loop');
      engine.stop();
      sub?.quit().catch(() => {});
      sub = null;
    }
  });
}

export async function releaseEngineLeadership(_instanceId: string): Promise<void> {
  try { await sub?.quit(); } catch { /* ignore */ }
  sub = null;
}
