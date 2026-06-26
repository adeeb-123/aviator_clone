import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { Bet } from '../models/Bet';
import { Transaction } from '../models/Transaction';
import { adjustBalance } from '../services/ledger';
import { env } from '../config/env';
import { asyncHandler } from '../middleware/error';
import { badRequest, notFound } from '../utils/errors';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

interface Badge { id: string; label: string; icon: string; earned: boolean; hint: string; }

/** GET /users/stats — the player's personal performance + earned badges. */
export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const oid = new Types.ObjectId(req.user!.sub);
  const [agg] = await Bet.aggregate([
    { $match: { userId: oid } },
    {
      $group: {
        _id: null,
        bets: { $sum: 1 },
        wins: { $sum: { $cond: [{ $eq: ['$status', 'cashed-out'] }, 1, 0] } },
        wagered: { $sum: '$amount' },
        won: { $sum: '$payout' },
        biggestMultiplier: { $max: '$cashoutMultiplier' },
        biggestBet: { $max: '$amount' },
        biggestWin: { $max: '$payout' },
        avgBet: { $avg: '$amount' },
      },
    },
  ]);
  const a = agg ?? { bets: 0, wins: 0, wagered: 0, won: 0, biggestMultiplier: 0, biggestBet: 0, biggestWin: 0, avgBet: 0 };

  // current win streak from the most recent bets
  const recentBets = await Bet.find({ userId: oid }).sort({ createdAt: -1 }).limit(60).select('status').lean();
  let winStreak = 0;
  for (const b of recentBets) { if (b.status === 'cashed-out') winStreak++; else break; }

  const winRate = a.bets ? round2((a.wins / a.bets) * 100) : 0;
  const netPL = round2(a.won - a.wagered);

  const badges: Badge[] = [
    { id: 'first-win', icon: '🎯', label: 'First Win', earned: a.wins >= 1, hint: 'Win a round' },
    { id: 'high-roller', icon: '💰', label: 'High Roller', earned: a.biggestBet >= 500, hint: 'Bet ₹500+ in one go' },
    { id: 'lucky', icon: '🍀', label: 'Lucky', earned: (a.biggestMultiplier ?? 0) >= 10, hint: 'Cash out at 10x+' },
    { id: 'sharp', icon: '🎓', label: 'Sharp Shooter', earned: a.bets >= 20 && winRate >= 60, hint: '60%+ win rate over 20 bets' },
    { id: 'veteran', icon: '🛡️', label: 'Veteran', earned: a.bets >= 100, hint: 'Place 100 bets' },
    { id: 'whale', icon: '🐋', label: 'Whale', earned: a.wagered >= 10000, hint: 'Wager ₹10,000 total' },
    { id: 'streak', icon: '🔥', label: 'On Fire', earned: winStreak >= 3, hint: 'Win 3 in a row' },
    { id: 'profit', icon: '📈', label: 'In Profit', earned: netPL > 0, hint: 'Be net positive' },
  ];

  res.json({
    stats: {
      bets: a.bets,
      wins: a.wins,
      losses: a.bets - a.wins,
      winRate,
      wagered: round2(a.wagered),
      won: round2(a.won),
      netPL,
      biggestMultiplier: round2(a.biggestMultiplier ?? 0),
      biggestWin: round2(a.biggestWin ?? 0),
      avgBet: round2(a.avgBet ?? 0),
      winStreak,
    },
    badges,
  });
});

/** POST /users/daily-claim — claim the once-a-day reward (streak grows on consecutive days). */
export const claimDaily = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.sub);
  if (!user) throw notFound('User not found');
  const now = new Date();
  const today = startOfDay(now);

  if (user.lastDailyClaim && startOfDay(user.lastDailyClaim).getTime() === today.getTime()) {
    return res.json({ claimed: false, alreadyClaimed: true, streak: user.dailyStreak });
  }
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const continued = user.lastDailyClaim && startOfDay(user.lastDailyClaim).getTime() === yesterday.getTime();
  const streak = continued ? user.dailyStreak + 1 : 1;
  const reward = Math.min(env.game.dailyBase * streak, env.game.dailyCap);

  user.dailyStreak = streak;
  user.lastDailyClaim = now;
  await user.save();
  const balance = await adjustBalance({ userId: user._id, amount: reward, type: 'bonus', description: `Daily reward (day ${streak})` });

  res.json({ claimed: true, reward, streak, balance });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.sub);
  if (!user) throw notFound('User not found');
  res.json({ user: user.toJSON() });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const updates = req.body;
  if (updates.username) {
    const taken = await User.findOne({ username: updates.username, _id: { $ne: req.user!.sub } });
    if (taken) throw badRequest('Username already taken');
  }
  const user = await User.findByIdAndUpdate(req.user!.sub, { $set: updates }, { new: true });
  res.json({ user: user!.toJSON() });
});

export const getBetHistory = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, parseInt(String(req.query.limit ?? '20'), 10));
  const status = req.query.status as string | undefined;

  const filter: Record<string, unknown> = { userId: req.user!.sub };
  if (status) filter.status = status;

  const [bets, total] = await Promise.all([
    Bet.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Bet.countDocuments(filter),
  ]);
  res.json({ bets, total, page, pages: Math.ceil(total / limit) });
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(100, parseInt(String(req.query.limit ?? '30'), 10));
  const txs = await Transaction.find({ userId: req.user!.sub }).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ transactions: txs });
});

// ── favorites (saved strategies) ───────────────────────────
export const getFavorites = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.sub).select('favorites').lean();
  res.json({ favorites: user?.favorites ?? [] });
});

export const addFavorite = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(
    req.user!.sub,
    { $push: { favorites: req.body } },
    { new: true },
  );
  res.json({ favorites: user!.favorites });
});

export const removeFavorite = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  const user = await User.findByIdAndUpdate(
    req.user!.sub,
    { $pull: { favorites: { name } } },
    { new: true },
  );
  res.json({ favorites: user!.favorites });
});

// ── transfer to another player ─────────────────────────────
export const transfer = asyncHandler(async (req: Request, res: Response) => {
  const { toUsername, amount } = req.body;
  const recipient = await User.findOne({ username: toUsername });
  if (!recipient) throw notFound('Recipient not found');
  if (String(recipient._id) === req.user!.sub) throw badRequest('Cannot transfer to yourself');

  // Debit the sender first (atomic, with sufficient-funds guard).
  let balance = await adjustBalance({
    userId: req.user!.sub,
    amount: -amount,
    type: 'withdraw',
    description: `Transfer to ${toUsername}`,
  });
  // Credit the recipient; if that fails, refund the sender so money is never lost.
  try {
    await adjustBalance({
      userId: recipient._id,
      amount,
      type: 'deposit',
      description: `Transfer from ${req.user!.username}`,
    });
  } catch (err) {
    balance = await adjustBalance({
      userId: req.user!.sub,
      amount,
      type: 'refund',
      description: `Refund — failed transfer to ${toUsername}`,
    });
    throw badRequest('Transfer failed — your funds were refunded');
  }
  res.json({ balance });
});
