/** Spin-the-wheel segments (₹ prize + relative weight) and the XP/level ladder. */
export interface SpinSegment { label: string; amount: number; weight: number; color: string }

export const SPIN_SEGMENTS: SpinSegment[] = [
  { label: '₹5', amount: 5, weight: 26, color: '#6366f1' },
  { label: '₹10', amount: 10, weight: 22, color: '#8b5cf6' },
  { label: '₹20', amount: 20, weight: 16, color: '#22c55e' },
  { label: '₹50', amount: 50, weight: 9, color: '#eab308' },
  { label: '₹0', amount: 0, weight: 12, color: '#475569' },
  { label: '₹100', amount: 100, weight: 4, color: '#f59e0b' },
  { label: '₹15', amount: 15, weight: 8, color: '#06b6d4' },
  { label: '₹250', amount: 250, weight: 3, color: '#ef4444' },
];

/** Weighted random pick → segment index. */
export function pickSpinIndex(): number {
  const total = SPIN_SEGMENTS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SPIN_SEGMENTS.length; i++) {
    r -= SPIN_SEGMENTS[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

/**
 * XP & levels — progression from activity (distinct from VIP, which is money-based).
 * XP = bets×10 + wins×25. Level threshold is quadratic: level L needs L²·100 XP.
 */
export function xpFor(bets: number, wins: number): number {
  return bets * 10 + wins * 25;
}

export function levelFor(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 100));
  const curMin = level * level * 100;
  const nextMin = (level + 1) * (level + 1) * 100;
  const progressPct = Math.min(100, Math.round(((xp - curMin) / (nextMin - curMin)) * 100));
  return { level, xp, curMin, nextMin, toNext: Math.max(0, nextMin - xp), progressPct };
}

/** Cosmetic title for a level band. */
export function levelTitle(level: number): string {
  if (level >= 30) return 'Legend';
  if (level >= 20) return 'Ace Pilot';
  if (level >= 12) return 'Captain';
  if (level >= 6) return 'Co-Pilot';
  if (level >= 2) return 'Cadet';
  return 'Rookie';
}
