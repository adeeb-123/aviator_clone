import { Request, Response } from 'express';
import { Tournament } from '../models/Tournament';
import { computeStandings, effectiveStatus, endTournament, metricLabel } from '../services/tournamentService';
import { logAdmin } from '../services/adminAudit';
import { asyncHandler } from '../middleware/error';
import { badRequest, notFound } from '../utils/errors';

/** Lazily settle any tournaments whose end time has passed. */
async function settleExpired(now: Date): Promise<void> {
  const due = await Tournament.find({ status: { $ne: 'ended' }, endAt: { $lte: now } });
  for (const t of due) await endTournament(t);
}

/** GET /tournaments — active + upcoming + recently ended, each with top standings. */
export const listPublic = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  await settleExpired(now);
  const list = await Tournament.find({ $or: [{ endAt: { $gte: new Date(now.getTime() - 7 * 864e5) } }, { status: { $ne: 'ended' } }] })
    .sort({ startAt: 1 }).limit(20).lean();

  const withStandings = await Promise.all(
    list.map(async (t) => ({
      ...t,
      status: effectiveStatus(t, now),
      metricLabel: metricLabel(t.metric),
      prizePool: t.prizes.reduce((s, p) => s + p, 0),
      standings: t.status === 'ended' && t.winners.length ? [] : await computeStandings(t, 5, now),
    })),
  );
  res.json({ tournaments: withStandings });
});

/** GET /tournaments/:id — full detail + standings. */
export const detail = asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const t = await Tournament.findById(req.params.id).lean();
  if (!t) throw notFound('Tournament not found');
  const standings = await computeStandings(t, 50, now);
  res.json({ tournament: { ...t, status: effectiveStatus(t, now), metricLabel: metricLabel(t.metric), prizePool: t.prizes.reduce((s, p) => s + p, 0) }, standings });
});

// ── admin ──────────────────────────────────────────────────
export const adminList = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const list = await Tournament.find().sort({ createdAt: -1 }).limit(50).lean();
  res.json({ tournaments: list.map((t) => ({ ...t, status: effectiveStatus(t, now), prizePool: t.prizes.reduce((s, p) => s + p, 0) })) });
});

export const adminCreate = asyncHandler(async (req: Request, res: Response) => {
  const { name, metric, startAt, endAt, prizes } = req.body ?? {};
  if (!name || !String(name).trim()) throw badRequest('Name is required');
  if (!['wagered', 'profit', 'wins', 'multiplier'].includes(metric)) throw badRequest('Invalid metric');
  const start = new Date(startAt), end = new Date(endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) throw badRequest('End must be after start');
  const prizeArr = (Array.isArray(prizes) ? prizes : []).map(Number).filter((n) => Number.isFinite(n) && n >= 0).slice(0, 10);
  if (prizeArr.length === 0) throw badRequest('Add at least one prize');
  const t = await Tournament.create({ name: String(name).trim().slice(0, 80), metric, startAt: start, endAt: end, prizes: prizeArr, createdBy: req.user!.username });
  logAdmin(req, 'tournament-create', `${t.name} (pool ₹${prizeArr.reduce((s, p) => s + p, 0)})`);
  res.json({ tournament: t });
});

export const adminEnd = asyncHandler(async (req: Request, res: Response) => {
  const t = await Tournament.findById(req.params.id);
  if (!t) throw notFound('Tournament not found');
  t.endAt = new Date(); // end now
  await t.save();
  const ended = await endTournament(t);
  logAdmin(req, 'tournament-end', t.name, { winners: ended.winners.length });
  res.json({ tournament: ended });
});

export const adminDelete = asyncHandler(async (req: Request, res: Response) => {
  const t = await Tournament.findById(req.params.id);
  if (!t) throw notFound('Tournament not found');
  if (t.paidOut) throw badRequest('Cannot delete a tournament that has paid out');
  await t.deleteOne();
  logAdmin(req, 'tournament-delete', t.name);
  res.json({ ok: true });
});
