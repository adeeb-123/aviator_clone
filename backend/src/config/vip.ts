/** VIP loyalty tiers — derived from a player's lifetime wagered volume. */
export interface VipTier {
  tier: number;
  name: string;
  icon: string;
  min: number; // lifetime wagered required to reach this tier (₹)
  cashback: number; // weekly cashback on net losses (fraction)
  dailyMult: number; // multiplier applied to the daily reward
  perk: string;
}

export const VIP_TIERS: VipTier[] = [
  { tier: 0, name: 'Bronze', icon: '🥉', min: 0, cashback: 0, dailyMult: 1, perk: 'Standard daily reward' },
  { tier: 1, name: 'Silver', icon: '🥈', min: 10_000, cashback: 0.01, dailyMult: 1.5, perk: '1% weekly cashback · 1.5× daily' },
  { tier: 2, name: 'Gold', icon: '🥇', min: 50_000, cashback: 0.02, dailyMult: 2, perk: '2% weekly cashback · 2× daily' },
  { tier: 3, name: 'Platinum', icon: '💎', min: 200_000, cashback: 0.03, dailyMult: 3, perk: '3% weekly cashback · 3× daily' },
  { tier: 4, name: 'Diamond', icon: '💠', min: 1_000_000, cashback: 0.05, dailyMult: 5, perk: '5% weekly cashback · 5× daily' },
];

/** Resolve the tier for a given lifetime-wagered amount, plus progress to the next tier. */
export function resolveVip(wagered: number) {
  let current = VIP_TIERS[0];
  for (const t of VIP_TIERS) if (wagered >= t.min) current = t;
  const next = VIP_TIERS[current.tier + 1] ?? null;
  const progressPct = next
    ? Math.min(100, Math.round(((wagered - current.min) / (next.min - current.min)) * 100))
    : 100;
  const toNext = next ? Math.max(0, next.min - wagered) : 0;
  return { current, next, progressPct, toNext };
}
