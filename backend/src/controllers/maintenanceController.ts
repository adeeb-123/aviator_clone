import { Request, Response } from 'express';
import { maintenanceState } from '../services/runtimeConfig';
import { asyncHandler } from '../middleware/error';

/**
 * Public, always-reachable endpoint so the frontend can render the maintenance
 * page (or not) before loading anything else. Returns ONLY the maintenance
 * fields — never the rest of the runtime config.
 */
export const getMaintenance = asyncHandler(async (_req: Request, res: Response) => {
  // Small client cache; the socket `maintenance:update` event flips it instantly.
  res.set('Cache-Control', 'public, max-age=10');
  res.json(maintenanceState());
});
