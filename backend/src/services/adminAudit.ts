import { Request } from 'express';
import { AdminAudit } from '../models/AdminAudit';
import { logger } from '../utils/logger';

/** Fire-and-forget record of a privileged admin action. Never throws. */
export function logAdmin(req: Request, action: string, detail = '', meta?: Record<string, unknown>): void {
  AdminAudit.create({
    adminId: req.user?.sub,
    adminUsername: req.user?.username ?? 'unknown',
    action,
    detail,
    meta,
  }).catch((err) => logger.warn({ err, action }, 'admin audit log failed'));
}
