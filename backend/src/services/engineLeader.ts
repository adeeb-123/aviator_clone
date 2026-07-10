import { logger } from '../utils/logger';

/**
 * Single-engine guard.
 *
 * The process that owns the HTTP port runs the game loop (engine.start() is called
 * from the listen callback, and a second process on the same host exits on
 * EADDRINUSE before it ever starts an engine). We deliberately do NOT use a Redis
 * lease/takeover here: earlier attempts could stop the *live* engine mid-round on a
 * ts-node-dev respawn and freeze the game. Instead the engine is self-healing —
 * duplicate-round detection makes a stray loop yield, and a watchdog force-crashes
 * any round that runs too long (see gameEngine).
 */
export function ensureSingleEngine(_instanceId: string, engine: { start: () => void; stop: () => void }): void {
  engine.start();
  logger.info('GameEngine started (single-port guard)');
}

export async function releaseEngineLeadership(_instanceId: string): Promise<void> {
  /* no-op — nothing held externally */
}
