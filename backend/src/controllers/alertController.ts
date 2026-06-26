import { Request, Response } from 'express';
import { Alert } from '../models/Alert';
import { alertThresholds } from '../services/alertService';
import { asyncHandler } from '../middleware/error';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(10, parseInt(String(req.query.limit ?? '50'), 10)));
  const filter = req.query.unreadOnly === 'true' ? { read: false } : {};
  const [alerts, unread] = await Promise.all([
    Alert.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Alert.countDocuments({ read: false }),
  ]);
  res.json({ alerts, unread });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await Alert.updateOne({ _id: req.params.id }, { read: true });
  const unread = await Alert.countDocuments({ read: false });
  res.json({ ok: true, unread });
});

export const markAllRead = asyncHandler(async (_req: Request, res: Response) => {
  await Alert.updateMany({ read: false }, { read: true });
  res.json({ ok: true, unread: 0 });
});

export const getConfig = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ thresholds: alertThresholds });
});

export const setConfig = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  for (const key of Object.keys(alertThresholds) as (keyof typeof alertThresholds)[]) {
    const v = body[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      alertThresholds[key] = v;
    }
  }
  res.json({ thresholds: alertThresholds });
});
