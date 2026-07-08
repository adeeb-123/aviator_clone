import { cfg } from './runtimeConfig';
import { logger } from '../utils/logger';

/**
 * Simulated "live" exchange rates. Each coin carries a drift factor that random-walks
 * around 1.0 (mean-reverting, bounded ±8%). The effective rate = adminBaseRate × factor,
 * so admins still set the anchor price while the displayed rate ticks like a market.
 */
const factors: Record<string, number> = {};
let timer: NodeJS.Timeout | null = null;

function step(f: number): number {
  const noise = (Math.random() - 0.5) * 0.008; // ±0.4% jitter per tick
  const revert = (1 - f) * 0.05; // gentle pull back toward 1.0
  return Math.min(1.08, Math.max(0.92, f + noise + revert));
}

export function startMarket(): void {
  if (timer) return;
  timer = setInterval(() => {
    for (const c of cfg().cryptoCoins) factors[c.symbol] = step(factors[c.symbol] ?? 1);
  }, 5000);
  logger.info('Crypto market simulator started');
}

export function stopMarket(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

export function getFactor(symbol: string): number {
  return factors[symbol] ?? 1;
}

/** Effective live rate (₹ per coin) for a given base rate. */
export function liveRate(baseRate: number, symbol: string): number {
  return Math.round(baseRate * getFactor(symbol) * 100) / 100;
}
