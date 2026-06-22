import { ServerSeed, IServerSeed } from '../models/ServerSeed';
import { generateServerSeed, sha256 } from '../utils/provablyFair';
import { logger } from '../utils/logger';

const SEED_TTL_MS = 24 * 60 * 60 * 1000; // 24h rotation

/** Return the currently active server seed, creating one if none exists or it expired. */
export async function getActiveSeed(): Promise<IServerSeed> {
  let seed: IServerSeed | null = await ServerSeed.findOne({ active: true });

  if (seed && seed.expiresAt.getTime() <= Date.now()) {
    await rotateSeed(seed);
    seed = null;
  }

  if (!seed) {
    seed = await createSeed();
  }
  return seed;
}

async function createSeed(): Promise<IServerSeed> {
  const raw = generateServerSeed();
  const seed = await ServerSeed.create({
    seed: raw,
    hash: sha256(raw),
    active: true,
    nonce: 0,
    expiresAt: new Date(Date.now() + SEED_TTL_MS),
  });
  logger.info({ hash: seed.hash }, 'New server seed created');
  return seed;
}

/** Reveal & deactivate an expired seed, then back-fill the raw seed onto its rounds. */
export async function rotateSeed(seed: IServerSeed): Promise<void> {
  seed.active = false;
  seed.revealedAt = new Date();
  await seed.save();

  // Reveal the raw seed on all rounds that used it so they become verifiable.
  const { Round } = await import('../models/Round');
  await Round.updateMany({ serverSeedId: seed._id }, { $set: { serverSeed: seed.seed } });
  logger.info({ hash: seed.hash }, 'Server seed rotated & revealed');
}

/** Atomically increment and return the next nonce for a seed. */
export async function nextNonce(seedId: IServerSeed['_id']): Promise<number> {
  const updated = await ServerSeed.findByIdAndUpdate(seedId, { $inc: { nonce: 1 } }, { new: true });
  return updated?.nonce ?? 1;
}
