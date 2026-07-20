import { Request, Response, NextFunction } from 'express';
import { cfg } from '../services/runtimeConfig';
import { verifyAccessToken } from '../utils/jwt';

// Paths that must stay reachable even during maintenance so an admin can log in,
// the frontend can read the maintenance state, and health checks keep passing.
const ALWAYS_ALLOWED = ['/health', '/api/auth', '/api/maintenance', '/api/admin', '/api/payments/webhook'];

function isAdminRequest(req: Request): boolean {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return false;
  try {
    return verifyAccessToken(token).role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Global maintenance gate for the API. When maintenance mode is on, public API
 * calls get a 503 with a maintenance payload; auth/admin/health/maintenance routes
 * and any authenticated admin still pass through so operators keep full control.
 */
export function maintenanceGuard(req: Request, res: Response, next: NextFunction): void {
  if (!cfg().maintenanceMode) return next();
  if (ALWAYS_ALLOWED.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next();
  if (isAdminRequest(req)) return next();

  res.status(503).set('Retry-After', '120').json({
    error: 'Service under maintenance',
    maintenance: true,
    message: cfg().maintenanceMessage,
  });
}
