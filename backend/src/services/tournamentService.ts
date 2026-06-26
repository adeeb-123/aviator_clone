import { Types } from 'mongoose';
import { Bet } from '../models/Bet';
import { Tournament, ITournament, TournamentMetric } from '../models/Tournament';
import { adjustBalance } from '../services/ledger';
import { logger } from '../utils/logger';

export interface StandingRow {
  rank: number;
  userId: string;
  username: string;
  wagered: number;
  profit: number;
  wins: number;
  multiplier: number;
  score: number;
}

const METRIC_LABEL: Record<TournamentMetric, string> = {
  wagered: 'Most wagered',
  profit: 'Highest profit',
  wins: 'Most wins',
  multiplier: 'Biggest multiplier',
};
export const metricLabel = (m: TournamentMetric) => METRIC_LABEL[m];

/** Effective status from the clock (DB status is updated lazily on read/end). */
export function effectiveStatus(t: ITournament, now: Date): 'scheduled' | 'active' | 'ended' {
  if (now < t.startAt) return 'scheduled';
  if (now >= t.endAt) return 'ended';
  return 'active';
}

/** Compute live standings from bets placed within the tournament window. */
export async function computeStandings(t: ITournament, limit = 20, now = new Date()): Promise<StandingRow[]> {
  const upper = now < t.endAt ? now : t.endAt;
  const rows = await Bet.aggregate([
    { $match: { createdAt: { $gte: t.startAt, $lte: upper } } },
    {
      $group: {
        _id: '$userId',
        username: { $first: '$username' },
        wagered: { $sum: '$amount' },
        won: { $sum: '$payout' },
        wins: { $sum: { $cond: [{ $eq: ['$status', 'cashed-out'] }, 1, 0] } },
        multiplier: { $max: '$cashoutMultiplier' },
      },
    },
    { $addFields: { profit: { $subtract: ['$won', '$wagered'] }, multiplier: { $ifNull: ['$multiplier', 0] } } },
    { $sort: { [t.metric]: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r, i) => ({
    rank: i + 1,
    userId: String(r._id),
    username: r.username,
    wagered: Math.round((r.wagered ?? 0) * 100) / 100,
    profit: Math.round((r.profit ?? 0) * 100) / 100,
    wins: r.wins ?? 0,
    multiplier: Math.round((r.multiplier ?? 0) * 100) / 100,
    score: Math.round((r[t.metric] ?? 0) * 100) / 100,
  }));
}

/** Finalise an ended tournament: compute winners, pay prizes once. */
export async function endTournament(t: ITournament): Promise<ITournament> {
  if (t.paidOut) return t;
  const standings = await computeStandings(t, t.prizes.length || 10, t.endAt);
  const winners = [];
  for (let i = 0; i < t.prizes.length; i++) {
    const row = standings[i];
    const prize = t.prizes[i];
    if (!row || prize <= 0 || row.score <= 0) continue;
    await adjustBalance({ userId: row.userId, amount: prize, type: 'bonus', description: `Tournament "${t.name}" — rank ${i + 1}` });
    winners.push({ rank: i + 1, userId: new Types.ObjectId(row.userId), username: row.username, score: row.score, prize });
  }
  const doc = await Tournament.findByIdAndUpdate(
    t._id,
    { $set: { status: 'ended', paidOut: true, winners } },
    { new: true },
  );
  logger.info({ tournament: t.name, winners: winners.length }, 'Tournament paid out');
  return doc!;
}
