import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessPayload } from '../utils/jwt';
import { unauthorized, forbidden } from '../utils/errors';
import { env } from '../config/env';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(unauthorized('Missing access token'));
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden('Admin access required'));
  // Admin APIs additionally require the session to have satisfied 2FA.
  if (env.enforceAdminMfa && !req.user.mfa) {
    return next(forbidden('Admin access requires two-factor authentication. Enable 2FA and log in again.'));
  }
  next();
}

/** Verifies a token if present but does not reject when absent (public + optional auth routes). */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      /* ignore */
    }
  }
  next();
}
