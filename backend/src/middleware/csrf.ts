import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { forbidden } from '../utils/errors';

const strip = (u: string) => u.replace(/\/$/, '');
const allowed = new Set([strip(env.frontendUrl), strip(env.backendUrl)]);

function originOf(url?: string): string {
  if (!url) return '';
  try {
    return strip(new URL(url).origin);
  } catch {
    return '';
  }
}

/**
 * CSRF defense for cookie-authenticated, state-changing routes (refresh/logout).
 * The refresh token rides in a cookie, so a cross-site page could otherwise trigger
 * it. We require the request's Origin (or Referer) to match our own frontend/backend
 * origin. Bearer-authenticated APIs don't need this — they aren't cookie-driven.
 */
export function sameOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'test') return next();
  const source = req.headers.origin ? strip(req.headers.origin) : originOf(req.headers.referer);
  if (source && allowed.has(source)) return next();
  return next(forbidden('Cross-origin request rejected'));
}
