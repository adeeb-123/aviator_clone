import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { Bet } from '../models/Bet';
import { Transaction } from '../models/Transaction';
import { adjustBalance } from '../services/ledger';
import { env } from '../config/env';
import { VIP_TIERS, resolveVip } from '../config/vip';
import { QUESTS, QuestMetric } from '../config/quests';
import { SPIN_SEGMENTS, pickSpinIndex, xpFor, levelFor, levelTitle } from '../config/rewards';
import { BADGES, BadgeStats } from '../config/badges';
import { PromoCode } from '../models/PromoCode';
import { Chat } from '../models/Chat';
import { getGameEngine } from '../services/gameEngine';
import { asyncHandler } from '../middleware/error';
import { badRequest, notFound } from '../utils/errors';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Lifetime wagered (₹) — drives VIP tier. */
async function lifetimeWagered(oid: Types.ObjectId): Promise<number> {
  const [a] = await Bet.aggregate([{ $match: { userId: oid } }, { $group: { _id: null, wagered: { $sum: '$amount' } } }]);
  return a?.wagered ?? 0;
}

/** Today's quest metrics from the player's bets placed since midnight. */
async function questMetrics(oid: Types.ObjectId, since: Date): Promise<Record<QuestMetric, number>> {
  const bets = await Bet.find({ userId: oid, createdAt: { $gte: since } }).select('status amount cashoutMultiplier').lean();
  return {
    bets: bets.length,
    wins: bets.filter((b) => b.status === 'cashed-out').length,
    wagered: bets.reduce((s, b) => s + (b.amount ?? 0), 0),
    highMult: bets.filter((b) => (b.cashoutMultiplier ?? 0) >= 2).length,
  };
}

/** Aggregate a user's lifetime bet stats + derived fields (shared by stats + profile). */
async function summarise(oid: Types.ObjectId, dailyStreak = 0) {
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
  const lvl = levelFor(xpFor(a.bets, a.wins));
  const level = { ...lvl, title: levelTitle(lvl.level) };

  const stats = {
    bets: a.bets, wins: a.wins, losses: a.bets - a.wins, winRate,
    wagered: round2(a.wagered), won: round2(a.won), netPL,
    biggestMultiplier: round2(a.biggestMultiplier ?? 0),
    biggestWin: round2(a.biggestWin ?? 0), biggestBet: round2(a.biggestBet ?? 0),
    avgBet: round2(a.avgBet ?? 0), winStreak,
  };
  const badgeStats: BadgeStats = {
    bets: a.bets, wins: a.wins, wagered: a.wagered, biggestBet: a.biggestBet ?? 0,
    biggestMultiplier: a.biggestMultiplier ?? 0, biggestWin: a.biggestWin ?? 0,
    winRate, winStreak, netPL, dailyStreak, level: level.level,
  };
  return { stats, badgeStats, level };
}

/** GET /users/stats — the player's personal performance + earned/claimable badges. */
export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const oid = new Types.ObjectId(req.user!.sub);
  const user = await User.findById(oid).select('dailyStreak claimedBadges').lean();
  const { stats, badgeStats, level } = await summarise(oid, user?.dailyStreak ?? 0);
  const claimed = new Set(user?.claimedBadges ?? []);
  const badges = BADGES.map((b) => ({
    id: b.id, icon: b.icon, label: b.label, hint: b.hint, reward: b.reward,
    earned: b.earned(badgeStats), claimed: claimed.has(b.id),
  }));
  res.json({ stats, badges, level });
});

/** GET /users/dashboard — consolidated personal overview + analytics for the profile page. */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const oid = new Types.ObjectId(req.user!.sub);
  const user = await User.findById(oid).select('username avatar bio balance dailyStreak referralCode vipTier createdAt claimedBadges').lean();
  if (!user) throw notFound('User not found');

  const { stats, badgeStats, level } = await summarise(oid, user.dailyStreak ?? 0);
  const { current, next, progressPct, toNext } = resolveVip(stats.wagered);

  // recent bets (newest first for the list; reversed for the cumulative chart)
  const recent = await Bet.find({ userId: oid }).sort({ createdAt: -1 }).limit(40)
    .select('amount payout status cashoutMultiplier roundId createdAt').lean();
  let cum = 0;
  const plChart = recent.slice().reverse().map((b, i) => {
    const pl = (b.payout ?? 0) - b.amount;
    cum = round2(cum + pl);
    return { n: i + 1, pl: round2(pl), cum };
  });

  // last 7 days performance (fill gaps)
  const since = startOfDay(new Date()); since.setDate(since.getDate() - 6);
  const agg = await Bet.aggregate([
    { $match: { userId: oid, createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, wagered: { $sum: '$amount' }, won: { $sum: '$payout' }, bets: { $sum: 1 } } },
  ]);
  const byDay = new Map(agg.map((d) => [d._id, d]));
  const daily: { date: string; wagered: number; won: number; net: number; bets: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(since); d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key);
    daily.push({ date: d.toLocaleDateString('en-IN', { weekday: 'short' }), wagered: round2(row?.wagered ?? 0), won: round2(row?.won ?? 0), net: round2((row?.won ?? 0) - (row?.wagered ?? 0)), bets: row?.bets ?? 0 });
  }

  const recentTx = await Transaction.find({ userId: oid }).sort({ createdAt: -1 }).limit(8).select('type amount balanceAfter description createdAt').lean();
  const badgesEarned = BADGES.filter((b) => b.earned(badgeStats)).length;

  res.json({
    profile: {
      username: user.username, avatar: user.avatar, bio: user.bio, balance: round2(user.balance),
      joinedAt: user.createdAt, dailyStreak: user.dailyStreak ?? 0, referralCode: user.referralCode,
      level: { ...level, title: level.title }, vipTier: current,
    },
    stats,
    vip: { tier: current, next, progressPct, toNext, wagered: stats.wagered },
    outcome: { wins: stats.wins, losses: stats.losses },
    plChart,
    daily,
    badgesEarned, totalBadges: BADGES.length,
    recentBets: recent.slice(0, 8),
    recentTx,
  });
});

/** POST /users/badges/:id/claim — claim a one-time milestone reward for an earned badge. */
export const claimBadge = asyncHandler(async (req: Request, res: Response) => {
  const def = BADGES.find((b) => b.id === req.params.id);
  if (!def) throw notFound('Badge not found');
  if (def.reward <= 0) throw badRequest('This badge has no reward to claim');
  const user = await User.findById(req.user!.sub);
  if (!user) throw notFound('User not found');
  if (user.claimedBadges.includes(def.id)) throw badRequest('Reward already claimed');
  const { badgeStats } = await summarise(user._id, user.dailyStreak);
  if (!def.earned(badgeStats)) throw badRequest('Badge not earned yet');
  user.claimedBadges.push(def.id);
  await user.save();
  const balance = await adjustBalance({ userId: user._id, amount: def.reward, type: 'bonus', description: `Achievement: ${def.label}` });
  res.json({ claimed: true, reward: def.reward, balance });
});

/** GET /users/profile/:username — public profile (no balance/email). */
export const getPublicProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findOne({ username: req.params.username }).select('username avatar bio vipTier dailyStreak createdAt claimedBadges').lean();
  if (!user) throw notFound('Player not found');
  const { stats, badgeStats, level } = await summarise(user._id, user.dailyStreak ?? 0);
  const earnedBadges = BADGES.filter((b) => b.earned(badgeStats)).map((b) => ({ id: b.id, icon: b.icon, label: b.label }));
  res.json({
    profile: {
      username: user.username, avatar: user.avatar, bio: user.bio,
      vipTier: user.vipTier, level, joinedAt: user.createdAt,
      stats: { bets: stats.bets, wins: stats.wins, winRate: stats.winRate, biggestMultiplier: stats.biggestMultiplier, biggestWin: stats.biggestWin },
      badges: earnedBadges, badgeCount: earnedBadges.length,
    },
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
  const { current } = resolveVip(await lifetimeWagered(user._id));
  const base = Math.min(env.game.dailyBase * streak, env.game.dailyCap);
  const reward = round2(base * current.dailyMult);

  user.dailyStreak = streak;
  user.lastDailyClaim = now;
  user.vipTier = current.tier;
  await user.save();
  const balance = await adjustBalance({ userId: user._id, amount: reward, type: 'bonus', description: `Daily reward (day ${streak}, ${current.name})` });

  res.json({ claimed: true, reward, streak, tier: current, balance });
});

/** GET /users/vip — current loyalty tier, progress to next, and the full ladder. */
export const getVip = asyncHandler(async (req: Request, res: Response) => {
  const oid = new Types.ObjectId(req.user!.sub);
  const wagered = await lifetimeWagered(oid);
  const { current, next, progressPct, toNext } = resolveVip(wagered);
  await User.updateOne({ _id: oid }, { $set: { vipTier: current.tier } });
  res.json({ wagered: round2(wagered), tier: current, next, progressPct, toNext, tiers: VIP_TIERS });
});

/** POST /users/cashback — weekly cashback on net losses (Silver+). Once per 7 days. */
export const claimCashback = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.sub);
  if (!user) throw notFound('User not found');
  const now = new Date();
  const { current } = resolveVip(await lifetimeWagered(user._id));
  if (current.cashback <= 0) throw badRequest('Cashback unlocks at Silver tier — keep playing to level up!');
  if (user.lastCashbackAt && now.getTime() - user.lastCashbackAt.getTime() < WEEK_MS) {
    const nextAt = new Date(user.lastCashbackAt.getTime() + WEEK_MS);
    return res.json({ claimed: false, reason: 'Already claimed this week', nextAt });
  }
  const since = user.lastCashbackAt ?? new Date(now.getTime() - WEEK_MS);
  const [a] = await Bet.aggregate([
    { $match: { userId: user._id, createdAt: { $gte: since } } },
    { $group: { _id: null, wagered: { $sum: '$amount' }, won: { $sum: '$payout' } } },
  ]);
  const netPL = (a?.won ?? 0) - (a?.wagered ?? 0);
  user.lastCashbackAt = now;
  await user.save();
  if (netPL >= 0) return res.json({ claimed: false, reason: 'No net losses this week — nothing to refund 🎉' });
  const cashback = round2(Math.abs(netPL) * current.cashback);
  const balance = await adjustBalance({ userId: user._id, amount: cashback, type: 'bonus', description: `Weekly cashback (${current.name})` });
  res.json({ claimed: true, cashback, tier: current, balance });
});

/** GET /users/referrals — the player's referral code, who they invited, and earnings. */
export const getReferrals = asyncHandler(async (req: Request, res: Response) => {
  const me = await User.findById(req.user!.sub).select('referralCode').lean();
  const referrals = await User.find({ referredBy: req.user!.sub }).select('username createdAt').sort({ createdAt: -1 }).limit(100).lean();
  res.json({
    code: me?.referralCode ?? '',
    count: referrals.length,
    bonusPerReferral: env.game.referralBonus,
    earned: round2(referrals.length * env.game.referralBonus),
    referrals,
  });
});

/** GET /users/quests — today's missions with live progress and claim state. */
export const getQuests = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.sub);
  if (!user) throw notFound('User not found');
  const today = startOfDay(new Date());
  const metrics = await questMetrics(user._id, today);
  const claimedToday = user.questDay && startOfDay(user.questDay).getTime() === today.getTime() ? user.questClaimed : [];
  const quests = QUESTS.map((q) => ({
    ...q,
    progress: Math.min(metrics[q.metric], q.target),
    completed: metrics[q.metric] >= q.target,
    claimed: claimedToday.includes(q.id),
  }));
  res.json({ quests, metrics });
});

/** POST /users/quests/:id/claim — claim a completed daily quest's reward. */
export const claimQuest = asyncHandler(async (req: Request, res: Response) => {
  const def = QUESTS.find((q) => q.id === req.params.id);
  if (!def) throw notFound('Quest not found');
  const user = await User.findById(req.user!.sub);
  if (!user) throw notFound('User not found');
  const today = startOfDay(new Date());
  const isToday = user.questDay && startOfDay(user.questDay).getTime() === today.getTime();
  const claimed = isToday ? user.questClaimed : [];
  if (claimed.includes(def.id)) throw badRequest('Quest already claimed today');

  const metrics = await questMetrics(user._id, today);
  if (metrics[def.metric] < def.target) throw badRequest('Quest not complete yet');

  user.questDay = today;
  user.questClaimed = [...claimed, def.id];
  await user.save();
  const balance = await adjustBalance({ userId: user._id, amount: def.reward, type: 'bonus', description: `Quest: ${def.label}` });
  res.json({ claimed: true, reward: def.reward, balance });
});

/** GET /users/spin — wheel segments + whether the daily free spin is available. */
export const getSpin = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.sub).select('lastSpinAt').lean();
  const today = startOfDay(new Date());
  const canSpin = !user?.lastSpinAt || startOfDay(user.lastSpinAt).getTime() !== today.getTime();
  res.json({ canSpin, segments: SPIN_SEGMENTS, lastSpinAt: user?.lastSpinAt ?? null });
});

/** POST /users/spin — take the once-a-day spin; returns the winning segment index. */
export const doSpin = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.sub);
  if (!user) throw notFound('User not found');
  const today = startOfDay(new Date());
  if (user.lastSpinAt && startOfDay(user.lastSpinAt).getTime() === today.getTime()) {
    throw badRequest('You already spun today — come back tomorrow!');
  }
  const index = pickSpinIndex();
  const seg = SPIN_SEGMENTS[index];
  user.lastSpinAt = new Date();
  await user.save();
  let balance = user.balance;
  if (seg.amount > 0) balance = await adjustBalance({ userId: user._id, amount: seg.amount, type: 'bonus', description: `Daily spin: ${seg.label}` });
  res.json({ index, segment: seg, prize: seg.amount, balance });
});

/** POST /users/redeem — redeem a promo/bonus code for credits. */
export const redeemPromo = asyncHandler(async (req: Request, res: Response) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  if (!code) throw badRequest('Enter a code');
  const promo = await PromoCode.findOne({ code });
  if (!promo || !promo.active) throw badRequest('Invalid or inactive code');
  if (promo.expiresAt && promo.expiresAt < new Date()) throw badRequest('This code has expired');
  if (promo.maxUses > 0 && promo.uses >= promo.maxUses) throw badRequest('This code has reached its redemption limit');
  if (promo.redeemedBy.some((id) => String(id) === req.user!.sub)) throw badRequest('You already redeemed this code');

  promo.uses += 1;
  promo.redeemedBy.push(new Types.ObjectId(req.user!.sub));
  await promo.save();
  const balance = await adjustBalance({ userId: req.user!.sub, amount: promo.amount, type: 'bonus', description: `Promo code ${code}` });
  res.json({ redeemed: true, amount: promo.amount, balance });
});

/** POST /users/rain — split a sum among recent active chatters (spread the love 🌧️). */
export const rain = asyncHandler(async (req: Request, res: Response) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount < 10) throw badRequest('Minimum rain is ₹10');
  if (amount > 10000) throw badRequest('Maximum rain is ₹10,000');
  const since = new Date(Date.now() - 20 * 60 * 1000);
  const ids = (await Chat.find({ createdAt: { $gte: since }, userId: { $ne: req.user!.sub } }).distinct('userId')).slice(0, 15);
  if (ids.length === 0) throw badRequest('No active chatters to rain on right now');
  const share = Math.floor((amount / ids.length) * 100) / 100;
  if (share <= 0) throw badRequest('Amount too small to split');
  const total = round2(share * ids.length);

  const balance = await adjustBalance({ userId: req.user!.sub, amount: -total, type: 'withdraw', description: `Chat rain on ${ids.length} players` });
  for (const id of ids) {
    const b = await adjustBalance({ userId: id, amount: share, type: 'bonus', description: `Rain from ${req.user!.username}` });
    getGameEngine().emitToUser(String(id), 'balance:update', { balance: b });
  }
  getGameEngine().emit('chat:message', {
    id: 'rain-' + req.user!.sub + '-' + total,
    username: '🌧️ Rain',
    avatar: '🌧️',
    message: `${req.user!.username} made it rain ₹${total} on ${ids.length} players! 💸`,
    createdAt: new Date(),
  });
  res.json({ ok: true, total, recipients: ids.length, share, balance });
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
