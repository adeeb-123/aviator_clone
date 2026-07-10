import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const flat = err.flatten();
    // Surface the first concrete field message so clients can show something useful
    // (e.g. "Password must be at least 8 characters") instead of a generic error.
    const firstField = Object.values(flat.fieldErrors).find((m) => Array.isArray(m) && m.length);
    const message = (firstField && firstField[0]) || flat.formErrors[0] || 'Please check the highlighted fields';
    res.status(400).json({ error: message, details: flat.fieldErrors });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  // Mongo duplicate key
  if (typeof err === 'object' && err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: 'Resource already exists' });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}

/** Wrap async handlers so thrown errors hit the error middleware. */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
