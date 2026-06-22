import { Request, Response } from 'express';
import { Round } from '../models/Round';
import { Bet } from '../models/Bet';
import { ServerSeed } from '../models/ServerSeed';
import { getLeaderboard, LeaderboardRange } from '../services/leaderboard';
import { getGameEngine } from '../services/gameEngine';
import { verifyRound } from '../utils/provablyFair';
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
  const bets = round
    ? await Bet.find({ roundId: round.roundId }).select('username amount cashoutMultiplier payout status slot').lean()
    : [];
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
