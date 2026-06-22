import { Request, Response } from 'express';
import { User } from '../models/User';
import { Bet } from '../models/Bet';
import { Transaction } from '../models/Transaction';
import { adjustBalance } from '../services/ledger';
import { asyncHandler } from '../middleware/error';
import { badRequest, notFound } from '../utils/errors';

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

  const balance = await adjustBalance({
    userId: req.user!.sub,
    amount: -amount,
    type: 'withdraw',
    description: `Transfer to ${toUsername}`,
  });
  await adjustBalance({
    userId: recipient._id,
    amount,
    type: 'deposit',
    description: `Transfer from ${req.user!.username}`,
  });
  res.json({ balance });
});
