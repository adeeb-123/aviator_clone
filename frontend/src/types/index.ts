export interface User {
  _id: string;
  username: string;
  email: string;
  balance: number;
  avatar?: string;
  bio?: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  vipTier: number;
  referralCode: string;
  favorites: FavoriteStrategy[];
  dailyStreak?: number;
  lastDailyClaim?: string;
}

export interface PlayerStats {
  bets: number;
  wins: number;
  losses: number;
  winRate: number;
  wagered: number;
  won: number;
  netPL: number;
  biggestMultiplier: number;
  biggestWin: number;
  avgBet: number;
  winStreak: number;
}

export interface Badge {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
  hint: string;
}

export interface FavoriteStrategy {
  name: string;
  amount: number;
  autoCashout?: number;
}

export type GamePhase = 'idle' | 'betting' | 'running' | 'crashed';

export interface PublicBet {
  username: string;
  amount: number;
  slot: 1 | 2;
  autoCashout?: number;
  cashoutMultiplier?: number;
  payout?: number;
  status: 'pending' | 'cashed-out' | 'lost';
}

export interface RoundHistoryItem {
  roundId: number;
  crashPoint: number;
  serverSeedHash: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  totalPayout: number;
  bestMultiplier: number;
  wins: number;
}

export interface ChatMessage {
  id: string;
  username: string;
  avatar?: string;
  message: string;
  createdAt: string;
}

export interface AdminAlert {
  _id?: string;
  id?: string;
  type: 'large-bet' | 'big-win' | 'high-balance' | 'large-withdrawal' | 'large-deposit' | 'big-payout';
  severity: 'info' | 'warning' | 'critical';
  userId?: string;
  username?: string;
  message: string;
  meta?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}
