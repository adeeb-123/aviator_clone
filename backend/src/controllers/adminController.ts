import { Request, Response } from 'express';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { Round } from '../models/Round';
import { ServerSeed } from '../models/ServerSeed';
import { adjustBalance } from '../services/ledger';
import { getActiveSeed, rotateSeed } from '../services/seedManager';
import { getGameEngine } from '../services/gameEngine';
import { env } from '../config/env';
import { asyncHandler } from '../middleware/error';
import { notFound, forbidden } from '../utils/errors';

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const engine = getGameEngine();
  const [users, rounds, revenueAgg] = await Promise.all([
    User.countDocuments(),
    Round.countDocuments({ status: 'crashed' }),
    Round.aggregate([
      { $match: { status: 'crashed' } },
      { $group: { _id: null, wagered: { $sum: '$totalWagered' }, payout: { $sum: '$totalPayout' } } },
    ]),
  ]);
  const rev = revenueAgg[0] ?? { wagered: 0, payout: 0 };
  res.json({
    game: engine.getSnapshot(),
    totals: {
      users,
      rounds,
      wagered: rev.wagered,
      payout: rev.payout,
      revenue: +(rev.wagered - rev.payout).toFixed(2),
    },
  });
});

export const revenueSeries = asyncHandler(async (_req: Request, res: Response) => {
  const series = await Round.aggregate([
    { $match: { status: 'crashed' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        wagered: { $sum: '$totalWagered' },
        payout: { $sum: '$totalPayout' },
        rounds: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 30 },
    {
      $project: {
        _id: 0,
        date: '$_id',
        wagered: 1,
        payout: 1,
        rounds: 1,
        revenue: { $round: [{ $subtract: ['$wagered', '$payout'] }, 2] },
      },
    },
  ]);
  res.json({ series });
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const q = (req.query.q as string) ?? '';
  const filter = q ? { $or: [{ username: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }] } : {};
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ users });
});

export const setUserFlag = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { isBanned, isSuspended, vipTier, role } = req.body;
  const update: Record<string, unknown> = {};
  if (typeof isBanned === 'boolean') update.isBanned = isBanned;
  if (typeof isSuspended === 'boolean') update.isSuspended = isSuspended;
  if (typeof vipTier === 'number') update.vipTier = vipTier;
  if (role === 'user' || role === 'admin') update.role = role;
  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true });
  if (!user) throw notFound('User not found');
  res.json({ user: user.toJSON() });
});

export const adjustUserBalance = asyncHandler(async (req: Request, res: Response) => {
  const { userId, amount, reason } = req.body;
  const balance = await adjustBalance({
    userId,
    amount,
    type: 'admin-adjust',
    description: reason ?? `Admin adjustment by ${req.user!.username}`,
  });
  res.json({ balance });
});

export const auditLog = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(200, parseInt(String(req.query.limit ?? '100'), 10));
  const txs = await Transaction.find().sort({ createdAt: -1 }).limit(limit).populate('userId', 'username').lean();
  res.json({ transactions: txs });
});

// ── game controls ──────────────────────────────────────────
export const gameStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json(getGameEngine().getAdminStatus());
});

export const pauseGame = asyncHandler(async (req: Request, res: Response) => {
  getGameEngine().setPaused(Boolean(req.body.paused));
  res.json(getGameEngine().getAdminStatus());
});

export const forceCrash = asyncHandler(async (req: Request, res: Response) => {
  if (!env.allowForceCrash) {
    throw forbidden('Force-crash is disabled (ALLOW_FORCE_CRASH=false) — it would break provably-fair.');
  }
  getGameEngine().forceCrashPoint(req.body.crashPoint);
  res.json(getGameEngine().getAdminStatus());
});

export const clearForceCrash = asyncHandler(async (_req: Request, res: Response) => {
  getGameEngine().clearForcedCrash();
  res.json(getGameEngine().getAdminStatus());
});

// ── seed management ────────────────────────────────────────
export const seedInfo = asyncHandler(async (_req: Request, res: Response) => {
  const active = await getActiveSeed();
  res.json({ activeHash: active.hash, expiresAt: active.expiresAt, nonce: active.nonce });
});

export const rotateActiveSeed = asyncHandler(async (_req: Request, res: Response) => {
  const active = await ServerSeed.findOne({ active: true });
  if (active) await rotateSeed(active);
  const next = await getActiveSeed();
  res.json({ rotated: true, newHash: next.hash });
});
