import { Bet } from '../models/Bet';
import { cacheGet, cacheSet } from '../config/redis';

export type LeaderboardRange = 'today' | 'week' | 'all';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  totalPayout: number;
  bestMultiplier: number;
  wins: number;
}

function rangeStart(range: LeaderboardRange): Date {
  const now = new Date();
  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (range === 'week') {
    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    return d;
  }
  return new Date(0);
}

export async function getLeaderboard(range: LeaderboardRange, limit = 20): Promise<LeaderboardEntry[]> {
  const cacheKey = `leaderboard:${range}:${limit}`;
  const cached = await cacheGet<LeaderboardEntry[]>(cacheKey);
  if (cached) return cached;

  const entries = await Bet.aggregate<LeaderboardEntry>([
    { $match: { status: 'cashed-out', createdAt: { $gte: rangeStart(range) } } },
    {
      $group: {
        _id: '$userId',
        username: { $first: '$username' },
        totalPayout: { $sum: '$payout' },
        bestMultiplier: { $max: '$cashoutMultiplier' },
        wins: { $sum: 1 },
      },
    },
    { $sort: { totalPayout: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        userId: { $toString: '$_id' },
        username: 1,
        totalPayout: { $round: ['$totalPayout', 2] },
        bestMultiplier: 1,
        wins: 1,
      },
    },
  ]);

  await cacheSet(cacheKey, entries, 15);
  return entries;
}
