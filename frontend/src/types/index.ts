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
