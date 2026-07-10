import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { Bet } from '../models/Bet';
import { Round } from '../models/Round';
import { Transaction } from '../models/Transaction';
import { getGameEngine } from '../services/gameEngine';
import { computeCrashPoint } from '../utils/provablyFair';
import { asyncHandler } from '../middleware/error';
import { notFound } from '../utils/errors';

const startOfToday = (): Date => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysAgo = (n: number): Date => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d; };
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * GET /admin/analytics/overview
 * Platform-wide KPIs from the operator's perspective: GGR (house profit),
 * margin, deposits/withdrawals, player base, game stats, crash distribution.
 */
export const overview = asyncHandler(async (_req: Request, res: Response) => {
  const today = startOfToday();
  const week = daysAgo(7);

  const [userRow, betRow, roundRow, txRows, distRows, uniqueBettors] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          banned: { $sum: { $cond: ['$isBanned', 1, 0] } },
          balances: { $sum: '$balance' },
          newToday: { $sum: { $cond: [{ $gte: ['$createdAt', today] }, 1, 0] } },
          newWeek: { $sum: { $cond: [{ $gte: ['$createdAt', week] }, 1, 0] } },
          activeToday: { $sum: { $cond: [{ $gte: ['$lastActiveAt', today] }, 1, 0] } },
          activeWeek: { $sum: { $cond: [{ $gte: ['$lastActiveAt', week] }, 1, 0] } },
        },
      },
    ]),
    Bet.aggregate([
      {
        $group: {
          _id: null,
          wagered: { $sum: '$amount' },
          won: { $sum: '$payout' },
          bets: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$status', 'cashed-out'] }, 1, 0] } },
          betsToday: { $sum: { $cond: [{ $gte: ['$createdAt', today] }, 1, 0] } },
          wageredToday: { $sum: { $cond: [{ $gte: ['$createdAt', today] }, '$amount', 0] } },
        },
      },
    ]),
    Round.aggregate([
      { $match: { status: 'crashed' } },
      {
        $group: {
          _id: null,
          rounds: { $sum: 1 },
          avgCrash: { $avg: '$crashPoint' },
          maxCrash: { $max: '$crashPoint' },
          instaBust: { $sum: { $cond: [{ $lt: ['$crashPoint', 1.01] }, 1, 0] } },
        },
      },
    ]),
    Transaction.aggregate([{ $group: { _id: '$type', count: { $sum: 1 }, sum: { $sum: '$amount' } } }]),
    Round.aggregate([
      { $match: { status: 'crashed' } },
      { $bucket: { groupBy: '$crashPoint', boundaries: [1, 1.01, 2, 5, 10, 50, 1_000_000], default: 'other', output: { count: { $sum: 1 } } } },
    ]),
    Bet.distinct('userId'),
  ]);

  const u = userRow[0] ?? {};
  const b = betRow[0] ?? {};
  const r = roundRow[0] ?? {};
  const txByType: Record<string, { count: number; sum: number }> = {};
  for (const t of txRows) txByType[t._id] = { count: t.count, sum: round2(t.sum) };

  const wagered = round2(b.wagered ?? 0);
  const payout = round2(b.won ?? 0);
  const ggr = round2(wagered - payout); // house profit (Gross Gaming Revenue)

  const labels = ['1.00x', '1.01–2x', '2–5x', '5–10x', '10–50x', '50x+'];
  const distribution = distRows
    .filter((d) => d._id !== 'other')
    .map((d, i) => ({ range: labels[i] ?? String(d._id), count: d.count }));

  res.json({
    users: {
      total: u.total ?? 0,
      admins: u.admins ?? 0,
      banned: u.banned ?? 0,
      newToday: u.newToday ?? 0,
      newWeek: u.newWeek ?? 0,
      activeToday: u.activeToday ?? 0,
      activeWeek: u.activeWeek ?? 0,
      returningWeek: Math.max(0, (u.activeWeek ?? 0) - (u.newWeek ?? 0)),
      playerBalances: round2(u.balances ?? 0),
    },
    financial: {
      wagered,
      payout,
      ggr,
      margin: wagered > 0 ? round2((ggr / wagered) * 100) : 0,
      wageredToday: round2(b.wageredToday ?? 0),
      deposits: txByType.deposit?.sum ?? 0,
      withdrawals: Math.abs(txByType.withdraw?.sum ?? 0),
      netDeposits: round2((txByType.deposit?.sum ?? 0) + (txByType.withdraw?.sum ?? 0)),
      bonusesPaid: txByType.bonus?.sum ?? 0,
      adminAdjustments: txByType['admin-adjust']?.sum ?? 0,
    },
    game: {
      rounds: r.rounds ?? 0,
      avgCrash: round2(r.avgCrash ?? 0),
      maxCrash: round2(r.maxCrash ?? 0),
      instaBust: r.instaBust ?? 0,
      instaBustRate: r.rounds ? round2((r.instaBust / r.rounds) * 100) : 0,
      bets: b.bets ?? 0,
      betsToday: b.betsToday ?? 0,
      wins: b.wins ?? 0,
      winRate: b.bets ? round2((b.wins / b.bets) * 100) : 0,
      uniqueBettors: uniqueBettors.length,
      online: getGameEngine().getSnapshot().players.length,
      phase: getGameEngine().getPhase(),
    },
    distribution,
    txBreakdown: txRows.map((t) => ({ type: t._id, count: t.count, sum: round2(t.sum) })).sort((a, b) => b.count - a.count),
  });
});

/**
 * GET /admin/analytics/timeseries?days=30
 * Daily financials for charts: wagered, payout, profit, rounds, bets, deposits, withdrawals, new users.
 */
export const timeseries = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(90, Math.max(7, parseInt(String(req.query.days ?? '30'), 10)));
  const since = daysAgo(days);
  const fmt = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

  const [rounds, txs, users] = await Promise.all([
    Round.aggregate([
      { $match: { status: 'crashed', createdAt: { $gte: since } } },
      { $group: { _id: fmt, wagered: { $sum: '$totalWagered' }, payout: { $sum: '$totalPayout' }, rounds: { $sum: 1 }, bets: { $sum: '$totalBets' } } },
    ]),
    Transaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: fmt,
          deposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
          withdrawals: { $sum: { $cond: [{ $eq: ['$type', 'withdraw'] }, '$amount', 0] } },
        },
      },
    ]),
    User.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: fmt, newUsers: { $sum: 1 } } }]),
  ]);

  const map = new Map<string, Record<string, number>>();
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key as unknown as number, wagered: 0, payout: 0, profit: 0, rounds: 0, bets: 0, deposits: 0, withdrawals: 0, newUsers: 0 });
  }
  for (const r of rounds) { const e = map.get(r._id); if (e) { e.wagered = round2(r.wagered); e.payout = round2(r.payout); e.profit = round2(r.wagered - r.payout); e.rounds = r.rounds; e.bets = r.bets; } }
  for (const t of txs) { const e = map.get(t._id); if (e) { e.deposits = round2(t.deposits); e.withdrawals = round2(Math.abs(t.withdrawals)); } }
  for (const us of users) { const e = map.get(us._id); if (e) e.newUsers = us.newUsers; }

  res.json({ days, series: [...map.values()] });
});

/**
 * GET /admin/analytics/rounds?limit=&page=
 * Per-round audit: economics (house P/L per round) + provably-fair verification
 * for revealed rounds (flags any manipulated/forced rounds).
 */
export const rounds = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(10, parseInt(String(req.query.limit ?? '30'), 10)));
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));

  const [total, list] = await Promise.all([
    Round.countDocuments({ status: 'crashed' }),
    Round.find({ status: 'crashed' })
      .sort({ roundId: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('roundId crashPoint totalBets totalWagered totalPayout serverSeedHash serverSeed clientSeed nonce endTime')
      .lean(),
  ]);

  const data = list.map((r) => {
    let fairnessOk: boolean | null = null;
    if (r.serverSeed) {
      const computed = computeCrashPoint(r.serverSeed, r.clientSeed, r.nonce);
      fairnessOk = Math.abs(computed - r.crashPoint) < 0.001;
    }
    return {
      roundId: r.roundId,
      crashPoint: r.crashPoint,
      bets: r.totalBets ?? 0,
      wagered: round2(r.totalWagered ?? 0),
      payout: round2(r.totalPayout ?? 0),
      housePL: round2((r.totalWagered ?? 0) - (r.totalPayout ?? 0)),
      revealed: !!r.serverSeed,
      fairnessOk,
      serverSeedHash: r.serverSeedHash,
      endTime: r.endTime,
    };
  });

  res.json({ rounds: data, total, page, pages: Math.ceil(total / limit) });
});

/**
 * GET /admin/analytics/players?sort=housePL&dir=desc&q=&limit=&page=
 * Per-user activity table: wagered, won, player P/L, HOUSE P/L (operator profit/loss),
 * win rate, deposits/withdrawals, balance, last active.
 */
export const players = asyncHandler(async (req: Request, res: Response) => {
  const sort = String(req.query.sort ?? 'housePL');
  const dir = req.query.dir === 'asc' ? 1 : -1;
  const q = String(req.query.q ?? '').trim();
  const active = String(req.query.active ?? 'all'); // all|today|week|month|inactive
  const status = String(req.query.status ?? 'all'); // all|active|banned|muted
  const role = String(req.query.role ?? 'all'); // all|user|admin
  const segment = String(req.query.segment ?? 'all'); // all|whales|new|winning
  const limit = Math.min(200, Math.max(10, parseInt(String(req.query.limit ?? '50'), 10)));
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));

  const now = Date.now();
  const DAY = 864e5;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const [betsByUser, txByUser, userDocs] = await Promise.all([
    Bet.aggregate([
      {
        $group: {
          _id: '$userId',
          wagered: { $sum: '$amount' },
          won: { $sum: '$payout' },
          bets: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$status', 'cashed-out'] }, 1, 0] } },
          best: { $max: '$cashoutMultiplier' },
          lastBet: { $max: '$createdAt' },
        },
      },
    ]),
    Transaction.aggregate([
      {
        $group: {
          _id: '$userId',
          deposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
          withdrawals: { $sum: { $cond: [{ $eq: ['$type', 'withdraw'] }, '$amount', 0] } },
        },
      },
    ]),
    User.find(q ? { $or: [{ username: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }] } : {})
      .select('username email avatar balance role isBanned isSuspended chatMutedUntil vipTier lastActiveAt createdAt')
      .lean(),
  ]);

  const betMap = new Map(betsByUser.map((b) => [String(b._id), b]));
  const txMap = new Map(txByUser.map((t) => [String(t._id), t]));

  let rows = userDocs.map((u) => {
    const b = betMap.get(String(u._id)) ?? { wagered: 0, won: 0, bets: 0, wins: 0, best: 0, lastBet: null };
    const t = txMap.get(String(u._id)) ?? { deposits: 0, withdrawals: 0 };
    const wagered = round2(b.wagered);
    const won = round2(b.won);
    const muted = !!(u.chatMutedUntil && new Date(u.chatMutedUntil).getTime() > now);
    return {
      userId: String(u._id),
      username: u.username,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      isBanned: u.isBanned,
      isSuspended: u.isSuspended,
      muted,
      isNew: u.createdAt ? (now - new Date(u.createdAt).getTime()) < 7 * DAY : false,
      vipTier: u.vipTier,
      balance: round2(u.balance),
      lastActiveAt: u.lastActiveAt,
      createdAt: u.createdAt,
      wagered,
      won,
      playerPL: round2(won - wagered), // player's net (positive = player ahead)
      housePL: round2(wagered - won), // operator's net from this player (positive = profit)
      bets: b.bets,
      wins: b.wins,
      winRate: b.bets ? round2((b.wins / b.bets) * 100) : 0,
      bestMultiplier: round2(b.best ?? 0),
      deposits: round2(t.deposits),
      withdrawals: round2(Math.abs(t.withdrawals)),
      netDeposit: round2(t.deposits + t.withdrawals),
    };
  });

  // Summary reflects the whole (q-matched) base — computed BEFORE the tab filters.
  const lastActiveMs = (r: { lastActiveAt?: Date | null }) => (r.lastActiveAt ? new Date(r.lastActiveAt).getTime() : 0);
  const summary = {
    totalPlayers: rows.length,
    activeToday: rows.filter((r) => lastActiveMs(r) >= startOfToday.getTime()).length,
    active7d: rows.filter((r) => lastActiveMs(r) >= now - 7 * DAY).length,
    new7d: rows.filter((r) => r.isNew).length,
    banned: rows.filter((r) => r.isBanned).length,
    muted: rows.filter((r) => r.muted).length,
    totalBalance: round2(rows.reduce((s, r) => s + r.balance, 0)),
    totalWagered: round2(rows.reduce((s, r) => s + r.wagered, 0)),
    houseProfit: round2(rows.reduce((s, r) => s + r.housePL, 0)),
    winningPlayers: rows.filter((r) => r.playerPL > 0).length, // players ahead of the house
  };

  // ── tab filters ──
  if (active !== 'all') {
    rows = rows.filter((r) => {
      const ms = lastActiveMs(r);
      if (active === 'today') return ms >= startOfToday.getTime();
      if (active === 'week') return ms >= now - 7 * DAY;
      if (active === 'month') return ms >= now - 30 * DAY;
      if (active === 'inactive') return ms > 0 && ms < now - 30 * DAY; // no activity for 30+ days
      return true;
    });
  }
  if (status !== 'all') rows = rows.filter((r) => (status === 'banned' ? r.isBanned : status === 'muted' ? r.muted : !r.isBanned && !r.muted));
  if (role !== 'all') rows = rows.filter((r) => r.role === role);
  if (segment !== 'all') {
    rows = rows.filter((r) => (segment === 'whales' ? r.wagered >= 10000 : segment === 'new' ? r.isNew : segment === 'winning' ? r.playerPL > 0 : true));
  }

  const sortable = new Set(['housePL', 'playerPL', 'wagered', 'won', 'bets', 'balance', 'deposits', 'withdrawals', 'winRate', 'lastActiveAt', 'createdAt']);
  const key = sortable.has(sort) ? sort : 'housePL';
  rows.sort((a, b) => {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return (String(av ?? '') > String(bv ?? '') ? 1 : -1) * dir;
  });

  const total = rows.length;
  const paged = rows.slice((page - 1) * limit, page * limit);
  res.json({ players: paged, total, page, pages: Math.ceil(total / limit), summary });
});

/**
 * GET /admin/analytics/players/:userId — single-player deep dive.
 */
export const playerDetail = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await User.findById(userId).lean();
  if (!user) throw notFound('User not found');
  const oid = new Types.ObjectId(userId);

  const [betAgg, txAgg, recentBets, recentTx] = await Promise.all([
    Bet.aggregate([
      { $match: { userId: oid } },
      {
        $group: {
          _id: null,
          wagered: { $sum: '$amount' },
          won: { $sum: '$payout' },
          bets: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$status', 'cashed-out'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
          best: { $max: '$cashoutMultiplier' },
          avgBet: { $avg: '$amount' },
          biggestBet: { $max: '$amount' },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { userId: oid } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          sum: { $sum: '$amount' },
        },
      },
    ]),
    Bet.find({ userId: oid }).sort({ createdAt: -1 }).limit(25).select('roundId slot amount cashoutMultiplier payout status isAutoCashout createdAt').lean(),
    Transaction.find({ userId: oid }).sort({ createdAt: -1 }).limit(25).select('type amount balanceAfter description createdAt').lean(),
  ]);

  const b = betAgg[0] ?? { wagered: 0, won: 0, bets: 0, wins: 0, losses: 0, best: 0, avgBet: 0, biggestBet: 0 };
  const txByType: Record<string, { count: number; sum: number }> = {};
  for (const t of txAgg) txByType[t._id] = { count: t.count, sum: round2(t.sum) };

  res.json({
    user: { ...user, passwordHash: undefined, refreshTokenId: undefined },
    stats: {
      wagered: round2(b.wagered),
      won: round2(b.won),
      playerPL: round2(b.won - b.wagered),
      housePL: round2(b.wagered - b.won),
      bets: b.bets,
      wins: b.wins,
      losses: b.losses,
      winRate: b.bets ? round2((b.wins / b.bets) * 100) : 0,
      bestMultiplier: round2(b.best ?? 0),
      avgBet: round2(b.avgBet ?? 0),
      biggestBet: round2(b.biggestBet ?? 0),
      deposits: txByType.deposit?.sum ?? 0,
      withdrawals: Math.abs(txByType.withdraw?.sum ?? 0),
      bonuses: txByType.bonus?.sum ?? 0,
    },
    recentBets,
    recentTransactions: recentTx,
  });
});
