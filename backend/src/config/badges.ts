/** Achievement definitions — shared by the stats endpoint and the claim flow. */
export interface BadgeStats {
  bets: number;
  wins: number;
  wagered: number;
  biggestBet: number;
  biggestMultiplier: number;
  biggestWin: number;
  winRate: number;
  winStreak: number;
  netPL: number;
  dailyStreak: number;
  level: number;
}

export interface BadgeDef {
  id: string;
  icon: string;
  label: string;
  hint: string;
  reward: number; // one-time ₹ milestone reward (0 = cosmetic only)
  earned: (s: BadgeStats) => boolean;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-win', icon: '🎯', label: 'First Win', hint: 'Win a round', reward: 10, earned: (s) => s.wins >= 1 },
  { id: 'high-roller', icon: '💰', label: 'High Roller', hint: 'Bet ₹500+ in one go', reward: 25, earned: (s) => s.biggestBet >= 500 },
  { id: 'lucky', icon: '🍀', label: 'Lucky', hint: 'Cash out at 10x+', reward: 50, earned: (s) => s.biggestMultiplier >= 10 },
  { id: 'moonshot', icon: '🌙', label: 'Moonshot', hint: 'Cash out at 50x+', reward: 200, earned: (s) => s.biggestMultiplier >= 50 },
  { id: 'sharp', icon: '🎓', label: 'Sharp Shooter', hint: '60%+ win rate over 20 bets', reward: 50, earned: (s) => s.bets >= 20 && s.winRate >= 60 },
  { id: 'streak', icon: '🔥', label: 'On Fire', hint: 'Win 3 in a row', reward: 30, earned: (s) => s.winStreak >= 3 },
  { id: 'streak5', icon: '⚡', label: 'Unstoppable', hint: 'Win 5 in a row', reward: 75, earned: (s) => s.winStreak >= 5 },
  { id: 'veteran', icon: '🛡️', label: 'Veteran', hint: 'Place 100 bets', reward: 50, earned: (s) => s.bets >= 100 },
  { id: 'centurion', icon: '🏅', label: 'Centurion', hint: 'Win 100 rounds', reward: 150, earned: (s) => s.wins >= 100 },
  { id: 'whale', icon: '🐋', label: 'Whale', hint: 'Wager ₹10,000 total', reward: 100, earned: (s) => s.wagered >= 10000 },
  { id: 'tycoon', icon: '🏦', label: 'Tycoon', hint: 'Wager ₹1,00,000 total', reward: 500, earned: (s) => s.wagered >= 100000 },
  { id: 'profit', icon: '📈', label: 'In Profit', hint: 'Be net positive', reward: 0, earned: (s) => s.netPL > 0 },
  { id: 'bigwin', icon: '💎', label: 'Big Win', hint: 'Win ₹2,000 on one bet', reward: 100, earned: (s) => s.biggestWin >= 2000 },
  { id: 'loyal', icon: '📅', label: 'Loyal', hint: '7-day login streak', reward: 70, earned: (s) => s.dailyStreak >= 7 },
  { id: 'leveled', icon: '⭐', label: 'Rising Star', hint: 'Reach level 5', reward: 100, earned: (s) => s.level >= 5 },
];
