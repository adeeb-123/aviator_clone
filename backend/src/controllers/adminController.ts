import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { Round } from '../models/Round';
import { ServerSeed } from '../models/ServerSeed';
import { Chat } from '../models/Chat';
import { AdminAudit } from '../models/AdminAudit';
import { adjustBalance } from '../services/ledger';
import { getActiveSeed, rotateSeed } from '../services/seedManager';
import { getGameEngine } from '../services/gameEngine';
import { cfg, updateConfig } from '../services/runtimeConfig';
import { logAdmin } from '../services/adminAudit';
import { env } from '../config/env';
import { asyncHandler } from '../middleware/error';
import { notFound, forbidden, badRequest } from '../utils/errors';

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
  logAdmin(req, 'user-flag', `@${user.username}`, update);
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
  logAdmin(req, 'balance-adjust', `${amount > 0 ? '+' : ''}${amount}`, { userId, amount, reason });
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
  logAdmin(req, 'game-pause', req.body.paused ? 'paused' : 'resumed');
  res.json(getGameEngine().getAdminStatus());
});

export const forceCrash = asyncHandler(async (req: Request, res: Response) => {
  if (!env.allowForceCrash) {
    throw forbidden('Force-crash is disabled (ALLOW_FORCE_CRASH=false) — it would break provably-fair.');
  }
  getGameEngine().forceCrashPoint(req.body.crashPoint);
  logAdmin(req, 'force-crash', `${req.body.crashPoint}x`, { crashPoint: req.body.crashPoint });
  res.json(getGameEngine().getAdminStatus());
});

export const clearForceCrash = asyncHandler(async (req: Request, res: Response) => {
  const idx = req.body?.index;
  // Remove a single queued item if an index is given, otherwise clear the whole queue.
  if (typeof idx === 'number') getGameEngine().removeForcedCrashAt(idx);
  else getGameEngine().clearForcedCrash();
  res.json(getGameEngine().getAdminStatus());
});

export const reorderForceCrash = asyncHandler(async (req: Request, res: Response) => {
  const queue = req.body?.queue;
  if (!Array.isArray(queue)) throw badRequest('queue must be an array of numbers');
  getGameEngine().setForcedCrashQueue(queue.map(Number));
  res.json(getGameEngine().getAdminStatus());
});

// ── seed management ────────────────────────────────────────
export const seedInfo = asyncHandler(async (_req: Request, res: Response) => {
  const active = await getActiveSeed();
  res.json({ activeHash: active.hash, expiresAt: active.expiresAt, nonce: active.nonce });
});

export const rotateActiveSeed = asyncHandler(async (req: Request, res: Response) => {
  const active = await ServerSeed.findOne({ active: true });
  if (active) await rotateSeed(active);
  const next = await getActiveSeed();
  logAdmin(req, 'seed-rotate', next.hash.slice(0, 12) + '…');
  res.json({ rotated: true, newHash: next.hash });
});

// ── runtime config ─────────────────────────────────────────
export const getConfig = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ config: cfg() });
});

export const setConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await updateConfig(req.body ?? {});
  logAdmin(req, 'config-update', '', req.body);
  res.json({ config });
});

// ── admin action audit log ─────────────────────────────────
export const adminActions = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(200, parseInt(String(req.query.limit ?? '100'), 10));
  const actions = await AdminAudit.find().sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ actions });
});

// ── broadcast announcement to all players ──────────────────
export const broadcast = asyncHandler(async (req: Request, res: Response) => {
  const message = String(req.body?.message ?? '').trim();
  if (!message) throw badRequest('Message is required');
  const payload = { id: crypto.randomUUID(), message: message.slice(0, 280), severity: req.body?.severity === 'warning' ? 'warning' : 'info', createdAt: new Date() };
  getGameEngine().emit('announcement', payload);
  logAdmin(req, 'broadcast', payload.message);
  res.json({ ok: true, announcement: payload });
});

// ── chat moderation ────────────────────────────────────────
export const deleteChatMessage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await Chat.deleteOne({ _id: id });
  getGameEngine().emit('chat:delete', { id });
  logAdmin(req, 'chat-delete', id);
  res.json({ ok: true });
});

export const muteUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const minutes = Math.max(0, Math.min(10080, Number(req.body?.minutes ?? 60))); // up to 7 days; 0 = unmute
  const until = minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null;
  const user = await User.findByIdAndUpdate(userId, { $set: { chatMutedUntil: until } }, { new: true });
  if (!user) throw notFound('User not found');
  logAdmin(req, minutes > 0 ? 'chat-mute' : 'chat-unmute', `@${user.username}`, { minutes });
  res.json({ ok: true, chatMutedUntil: until, username: user.username });
});
