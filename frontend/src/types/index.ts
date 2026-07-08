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
  reward?: number;
  claimed?: boolean;
}

export interface PublicProfile {
  username: string;
  avatar?: string;
  bio?: string;
  vipTier: number;
  level: LevelInfo;
  joinedAt: string;
  stats: { bets: number; wins: number; winRate: number; biggestMultiplier: number; biggestWin: number };
  badges: { id: string; icon: string; label: string }[];
  badgeCount: number;
}

export interface FavoriteStrategy {
  name: string;
  amount: number;
  autoCashout?: number;
}

export interface VipTier {
  tier: number;
  name: string;
  icon: string;
  min: number;
  cashback: number;
  dailyMult: number;
  perk: string;
}

export interface VipInfo {
  wagered: number;
  tier: VipTier;
  next: VipTier | null;
  progressPct: number;
  toNext: number;
  tiers: VipTier[];
}

export interface ReferralEntry {
  _id: string;
  username: string;
  createdAt: string;
}

export interface ReferralInfo {
  code: string;
  count: number;
  bonusPerReferral: number;
  earned: number;
  referrals: ReferralEntry[];
}

export interface Quest {
  id: string;
  label: string;
  icon: string;
  target: number;
  metric: string;
  reward: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface BetHistoryItem {
  _id: string;
  roundId: number;
  amount: number;
  status: 'pending' | 'cashed-out' | 'lost';
  cashoutMultiplier?: number;
  payout?: number;
  createdAt: string;
}

export interface SpinSegment { label: string; amount: number; weight: number; color: string }

export interface LevelInfo {
  level: number;
  xp: number;
  curMin: number;
  nextMin: number;
  toNext: number;
  progressPct: number;
  title: string;
}

export interface PromoCodeRow {
  _id: string;
  code: string;
  amount: number;
  maxUses: number;
  uses: number;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface TournamentStanding {
  rank: number;
  userId: string;
  username: string;
  wagered: number;
  profit: number;
  wins: number;
  multiplier: number;
  score: number;
}

export interface TournamentWinner { rank: number; username: string; score: number; prize: number }

export interface Tournament {
  _id: string;
  name: string;
  metric: 'wagered' | 'profit' | 'wins' | 'multiplier';
  metricLabel?: string;
  startAt: string;
  endAt: string;
  prizes: number[];
  prizePool?: number;
  status: 'scheduled' | 'active' | 'ended';
  paidOut: boolean;
  winners: TournamentWinner[];
  standings?: TournamentStanding[];
}

export type GamePhase = 'idle' | 'betting' | 'running' | 'crashed';

export interface SideBetMarket {
  id: string;
  threshold: number;
  payout: number;
  enabled: boolean;
}

export interface CryptoCoin {
  symbol: string;
  name: string;
  rate: number; // INR per coin
  address?: string; // caller's deposit address
  enabled?: boolean;
}

export interface CryptoTx {
  _id: string;
  username?: string;
  type: 'deposit' | 'withdrawal';
  coin: string;
  cryptoAmount: number;
  inrAmount: number;
  rate: number;
  address: string;
  txHash?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'rejected';
  note?: string;
  createdAt: string;
}

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
  reactions?: Record<string, number>;
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
