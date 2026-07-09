import { Request, Response } from 'express';
import { Round } from '../models/Round';
import { Bet } from '../models/Bet';
import { ServerSeed } from '../models/ServerSeed';
import { getLeaderboard, LeaderboardRange } from '../services/leaderboard';
import { getGameEngine } from '../services/gameEngine';
import { verifyRound } from '../utils/provablyFair';
import { env } from '../config/env';
import { asyncHandler } from '../middleware/error';

export const getState = asyncHandler(async (_req: Request, res: Response) => {
  res.json(getGameEngine().getSnapshot());
});

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(100, parseInt(String(req.query.limit ?? '50'), 10));
  const rounds = await Round.find({ status: 'crashed' })
    .sort({ roundId: -1 })
    .limit(limit)
    .select('roundId crashPoint serverSeedHash clientSeed nonce serverSeed endTime totalWagered totalPayout')
    .lean();
  res.json({ rounds });
});

export const getRound = asyncHandler(async (req: Request, res: Response) => {
  const round = await Round.findOne({ roundId: parseInt(req.params.roundId, 10) }).lean();
  if (!round) return res.json({ round: null, bets: [] });
  const bets = await Bet.find({ roundId: round.roundId }).select('username amount cashoutMultiplier payout status slot').lean();

  // SECURITY: the crash point (and raw server seed) are stored the moment a round
  // opens for betting. Never expose them for a round that hasn't crashed yet — that
  // would let a player predict the outcome and cash out perfectly every time.
  if (round.status !== 'crashed') {
    const { crashPoint, serverSeed, ...safe } = round;
    void crashPoint; void serverSeed;
    return res.json({ round: safe, bets });
  }
  res.json({ round, bets });
});

export const getStats = asyncHandler(async (_req: Request, res: Response) => {
  const [agg] = await Round.aggregate([
    { $match: { status: 'crashed' } },
    {
      $group: {
        _id: null,
        totalRounds: { $sum: 1 },
        avgCrash: { $avg: '$crashPoint' },
        maxCrash: { $max: '$crashPoint' },
        totalWagered: { $sum: '$totalWagered' },
        totalPayout: { $sum: '$totalPayout' },
      },
    },
  ]);
  res.json({ stats: agg ?? {} });
});

/** GET /game/rtp — public fairness/return-to-player transparency stats. */
export const getRtp = asyncHandler(async (_req: Request, res: Response) => {
  const [[agg], buckets] = await Promise.all([
    Round.aggregate([
      { $match: { status: 'crashed' } },
      { $group: { _id: null, totalRounds: { $sum: 1 }, avgCrash: { $avg: '$crashPoint' }, maxCrash: { $max: '$crashPoint' }, totalWagered: { $sum: '$totalWagered' }, totalPayout: { $sum: '$totalPayout' } } },
    ]),
    Round.aggregate([
      { $match: { status: 'crashed' } },
      { $bucket: { groupBy: '$crashPoint', boundaries: [1, 1.5, 2, 3, 5, 10, 1e9], default: 'other', output: { count: { $sum: 1 } } } },
    ]),
  ]);

  const a = agg ?? { totalRounds: 0, avgCrash: 0, maxCrash: 0, totalWagered: 0, totalPayout: 0 };
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const rtp = a.totalWagered > 0 ? r2((a.totalPayout / a.totalWagered) * 100) : 0;

  const LABELS: Record<string, string> = { '1': '1.00–1.49x', '1.5': '1.50–1.99x', '2': '2.00–2.99x', '3': '3.00–4.99x', '5': '5.00–9.99x', '10': '10x+' };
  const totalBucketed = buckets.reduce((s: number, b: { count: number }) => s + b.count, 0) || 1;
  const distribution = buckets
    .filter((b: { _id: unknown }) => b._id !== 'other')
    .map((b: { _id: number; count: number }) => ({ range: LABELS[String(b._id)] ?? String(b._id), count: b.count, pct: r2((b.count / totalBucketed) * 100) }));

  res.json({
    rtp,
    houseEdge: r2(env.game.houseEdge * 100),
    theoreticalRtp: r2((1 - env.game.houseEdge) * 100),
    totalRounds: a.totalRounds,
    avgCrash: r2(a.avgCrash ?? 0),
    maxCrash: r2(a.maxCrash ?? 0),
    totalWagered: r2(a.totalWagered ?? 0),
    totalPayout: r2(a.totalPayout ?? 0),
    distribution,
  });
});

export const leaderboard = asyncHandler(async (req: Request, res: Response) => {
  const range = (req.query.range as LeaderboardRange) ?? 'today';
  const board = await getLeaderboard(range, 20);
  res.json({ range, leaderboard: board });
});

// ── provably fair ──────────────────────────────────────────
export const verify = asyncHandler(async (req: Request, res: Response) => {
  const result = verifyRound(req.query as never);
  res.json(result);
});

export const getRevealedSeeds = asyncHandler(async (_req: Request, res: Response) => {
  const seeds = await ServerSeed.find({ active: false })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('seed hash createdAt revealedAt')
    .lean();
  res.json({ seeds });
});
