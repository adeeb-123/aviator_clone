import { env } from '../config/env';
import { AppConfig } from '../models/AppConfig';
import { logger } from '../utils/logger';

/**
 * Runtime-editable settings. Defaults come from env; admins can override them
 * live from the panel. The game engine reads these fresh each round/bet, so a
 * change applies cleanly on the NEXT round — never mid-flight. House edge is
 * intentionally excluded (it is fairness-critical and must stay stable).
 */
export interface RuntimeConfig {
  minBet: number;
  maxBet: number;
  bettingWindowMs: number;
  roundPauseMs: number;
  blockAdminBetting: boolean;
  chatProfanityFilter: boolean;
  bannedWords: string[];
}

const DEFAULT_BANNED = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'scam', 'rigged'];

let cache: RuntimeConfig = {
  minBet: env.game.minBet,
  maxBet: env.game.maxBet,
  bettingWindowMs: env.game.bettingWindowMs,
  roundPauseMs: env.game.roundPauseMs,
  blockAdminBetting: true,
  chatProfanityFilter: true,
  bannedWords: DEFAULT_BANNED,
};

export function cfg(): RuntimeConfig {
  return cache;
}

/** Load persisted overrides into the in-memory cache (call once at startup). */
export async function loadConfig(): Promise<void> {
  try {
    const doc = await AppConfig.findOne({ key: 'game' }).lean<{ value?: Partial<RuntimeConfig> }>();
    if (doc?.value) cache = { ...cache, ...doc.value };
    logger.info('Runtime config loaded');
  } catch (err) {
    logger.warn({ err }, 'Runtime config load failed — using defaults');
  }
}

const clampNum = (n: unknown, lo: number, hi: number, fallback: number): number => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};

/** Validate + persist a patch, returning the new effective config. */
export async function updateConfig(patch: Partial<RuntimeConfig>): Promise<RuntimeConfig> {
  const next: RuntimeConfig = { ...cache };
  if (patch.minBet !== undefined) next.minBet = clampNum(patch.minBet, 1, 1_000_000, cache.minBet);
  if (patch.maxBet !== undefined) next.maxBet = clampNum(patch.maxBet, next.minBet, 10_000_000, cache.maxBet);
  if (patch.bettingWindowMs !== undefined) next.bettingWindowMs = clampNum(patch.bettingWindowMs, 3000, 60_000, cache.bettingWindowMs);
  if (patch.roundPauseMs !== undefined) next.roundPauseMs = clampNum(patch.roundPauseMs, 2000, 30_000, cache.roundPauseMs);
  if (patch.blockAdminBetting !== undefined) next.blockAdminBetting = Boolean(patch.blockAdminBetting);
  if (patch.chatProfanityFilter !== undefined) next.chatProfanityFilter = Boolean(patch.chatProfanityFilter);
  if (Array.isArray(patch.bannedWords)) next.bannedWords = patch.bannedWords.map((w) => String(w).toLowerCase().trim()).filter(Boolean).slice(0, 200);

  cache = next;
  await AppConfig.updateOne({ key: 'game' }, { $set: { value: cache } }, { upsert: true });
  return cache;
}

/** Mask configured banned words with asterisks (used by chat). */
export function filterProfanity(text: string): string {
  if (!cache.chatProfanityFilter || cache.bannedWords.length === 0) return text;
  let out = text;
  for (const w of cache.bannedWords) {
    if (!w) continue;
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, (m) => '*'.repeat(m.length));
  }
  return out;
}
