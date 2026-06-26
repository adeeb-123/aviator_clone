/** Daily quests — progress is computed from the player's bets placed *today*. */
export type QuestMetric = 'bets' | 'wins' | 'wagered' | 'highMult';

export interface QuestDef {
  id: string;
  label: string;
  icon: string;
  target: number;
  metric: QuestMetric;
  reward: number; // ₹ credited on claim
}

export const QUESTS: QuestDef[] = [
  { id: 'bets5', label: 'Place 5 bets', icon: '🎲', target: 5, metric: 'bets', reward: 20 },
  { id: 'win3', label: 'Win 3 rounds', icon: '🏆', target: 3, metric: 'wins', reward: 30 },
  { id: 'wager500', label: 'Wager ₹500 total', icon: '💸', target: 500, metric: 'wagered', reward: 25 },
  { id: 'big2x', label: 'Cash out at 2× or higher', icon: '🚀', target: 1, metric: 'highMult', reward: 40 },
];
