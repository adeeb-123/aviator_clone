import { Request } from 'express';
import { logger } from '../utils/logger';

export type AuthEvent =
  | 'login.success'
  | 'login.fail'
  | 'login.locked'
  | 'login.2fa_required'
  | 'login.2fa_fail'
  | 'refresh.reuse'
  | 'password.reset_requested'
  | 'password.reset_done'
  | '2fa.enabled'
  | '2fa.disabled';

/** Structured, greppable audit trail for authentication-related events. */
export function logAuthEvent(event: AuthEvent, req: Request, meta: Record<string, unknown> = {}): void {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
  const ua = req.headers['user-agent'];
  logger.warn({ authEvent: event, ip, ua, ...meta }, `auth:${event}`);
}
