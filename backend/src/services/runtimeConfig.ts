import { env } from '../config/env';
import { AppConfig } from '../models/AppConfig';
import { logger } from '../utils/logger';

/**
 * Runtime-editable settings. Defaults come from env; admins can override them
 * live from the panel. The game engine reads these fresh each round/bet, so a
 * change applies cleanly on the NEXT round — never mid-flight. House edge is
 * intentionally excluded (it is fairness-critical and must stay stable).
 */
/** A side-bet market: win if the round's crash point is >= threshold. */
export interface SideBetMarket {
  id: string;
  threshold: number; // crash must reach this multiplier to win
  payout: number; // multiplier paid on the stake (admin-tunable → controls the edge)
  enabled: boolean;
}

/** A supported crypto coin for deposits/withdrawals (demo — no real chain). */
export interface CryptoCoin {
  symbol: string; // BTC, ETH, USDT
  name: string;
  rate: number; // INR per 1 unit of the coin
  enabled: boolean;
}

export interface RuntimeConfig {
  minBet: number;
  maxBet: number;
  bettingWindowMs: number;
  roundPauseMs: number;
  blockAdminBetting: boolean;
  chatProfanityFilter: boolean;
  bannedWords: string[];
  // ── side bets (prop bets on the crash point) ──
  sideBetsEnabled: boolean;
  sideBetMin: number;
  sideBetMax: number;
  sideBetMarkets: SideBetMarket[];
  // ── progressive jackpot ──
  jackpotEnabled: boolean;
  jackpotRate: number; // fraction of each main wager added to the pot
  jackpotSeed: number; // pot resets to this after a win
  jackpotTrigger: number; // cash out at >= this multiplier to win the pot
  // ── crypto wallet (demo) ──
  cryptoEnabled: boolean;
  cryptoCoins: CryptoCoin[];
}

const DEFAULT_BANNED = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'scam', 'rigged'];

// Payouts sit just under the threshold so the house keeps an edge; admins can tune them.
const DEFAULT_MARKETS: SideBetMarket[] = [
  { id: 'over1_5', threshold: 1.5, payout: 1.45, enabled: true },
  { id: 'over2', threshold: 2, payout: 1.92, enabled: true },
  { id: 'over3', threshold: 3, payout: 2.85, enabled: true },
  { id: 'over5', threshold: 5, payout: 4.7, enabled: true },
  { id: 'over10', threshold: 10, payout: 9.2, enabled: true },
];

// Rate = INR per 1 coin (demo values; admin-tunable).
const DEFAULT_COINS: CryptoCoin[] = [
  { symbol: 'BTC', name: 'Bitcoin', rate: 5_000_000, enabled: true },
  { symbol: 'ETH', name: 'Ethereum', rate: 300_000, enabled: true },
  { symbol: 'USDT', name: 'Tether', rate: 85, enabled: true },
];

let cache: RuntimeConfig = {
  minBet: env.game.minBet,
  maxBet: env.game.maxBet,
  bettingWindowMs: env.game.bettingWindowMs,
  roundPauseMs: env.game.roundPauseMs,
  blockAdminBetting: true,
  chatProfanityFilter: true,
  bannedWords: DEFAULT_BANNED,
  sideBetsEnabled: true,
  sideBetMin: 10,
  sideBetMax: 1000,
  sideBetMarkets: DEFAULT_MARKETS,
  jackpotEnabled: true,
  jackpotRate: 0.01,
  jackpotSeed: 500,
  jackpotTrigger: 25,
  cryptoEnabled: true,
  cryptoCoins: DEFAULT_COINS,
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

  if (patch.sideBetsEnabled !== undefined) next.sideBetsEnabled = Boolean(patch.sideBetsEnabled);
  if (patch.sideBetMin !== undefined) next.sideBetMin = clampNum(patch.sideBetMin, 1, 1_000_000, cache.sideBetMin);
  if (patch.sideBetMax !== undefined) next.sideBetMax = clampNum(patch.sideBetMax, next.sideBetMin, 10_000_000, cache.sideBetMax);
  if (Array.isArray(patch.sideBetMarkets)) {
    next.sideBetMarkets = patch.sideBetMarkets
      .filter((m) => m && typeof m.id === 'string')
      .map((m) => ({ id: String(m.id).slice(0, 20), threshold: clampNum(m.threshold, 1.01, 1000, 2), payout: clampNum(m.payout, 1.01, 1000, 1.9), enabled: Boolean(m.enabled) }))
      .slice(0, 12);
  }
  if (patch.jackpotEnabled !== undefined) next.jackpotEnabled = Boolean(patch.jackpotEnabled);
  if (patch.jackpotRate !== undefined) next.jackpotRate = clampNum(patch.jackpotRate, 0, 0.1, cache.jackpotRate);
  if (patch.jackpotSeed !== undefined) next.jackpotSeed = clampNum(patch.jackpotSeed, 0, 1_000_000, cache.jackpotSeed);
  if (patch.jackpotTrigger !== undefined) next.jackpotTrigger = clampNum(patch.jackpotTrigger, 2, 10_000, cache.jackpotTrigger);

  if (patch.cryptoEnabled !== undefined) next.cryptoEnabled = Boolean(patch.cryptoEnabled);
  if (Array.isArray(patch.cryptoCoins)) {
    next.cryptoCoins = patch.cryptoCoins
      .filter((c) => c && typeof c.symbol === 'string')
      .map((c) => ({ symbol: String(c.symbol).toUpperCase().slice(0, 8), name: String(c.name ?? c.symbol).slice(0, 30), rate: clampNum(c.rate, 0.0001, 1e12, 1), enabled: Boolean(c.enabled) }))
      .slice(0, 20);
  }

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
