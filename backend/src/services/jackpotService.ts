import { Jackpot } from '../models/Jackpot';
import { cfg } from './runtimeConfig';
import { logger } from '../utils/logger';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
let pot = 0;

export function getPot(): number {
  return r2(pot);
}

/** Load the persisted pot at startup (seed it if missing). */
export async function loadJackpot(): Promise<void> {
  try {
    const doc = await Jackpot.findOneAndUpdate(
      { key: 'main' },
      { $setOnInsert: { pot: cfg().jackpotSeed } },
      { upsert: true, new: true },
    );
    pot = doc?.pot ?? cfg().jackpotSeed;
    logger.info({ pot }, 'Jackpot loaded');
  } catch (err) {
    logger.warn({ err }, 'Jackpot load failed');
  }
}

/** Grow the pot from a main-bet wager (house-funded in this sandbox economy). */
export async function contribute(wager: number): Promise<number> {
  if (!cfg().jackpotEnabled || cfg().jackpotRate <= 0) return getPot();
  const add = r2(wager * cfg().jackpotRate);
  if (add <= 0) return getPot();
  pot = r2(pot + add);
  await Jackpot.updateOne({ key: 'main' }, { $inc: { pot: add } });
  return getPot();
}

/** Award the whole pot to a winner and reset it to the configured seed. */
export async function awardJackpot(username: string): Promise<number> {
  const won = r2(pot);
  const seed = cfg().jackpotSeed;
  pot = seed;
  await Jackpot.updateOne({ key: 'main' }, { $set: { pot: seed, lastWonBy: username, lastWonAmount: won, lastWonAt: new Date() } });
  return won;
}

/** Admin: force the pot to a value. */
export async function setPot(value: number): Promise<number> {
  pot = r2(Math.max(0, value));
  await Jackpot.updateOne({ key: 'main' }, { $set: { pot } }, { upsert: true });
  return getPot();
}
