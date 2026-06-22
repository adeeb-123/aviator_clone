import { Router } from 'express';
import * as ctrl from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { adminAdjustSchema, adminCrashSchema } from '../validators/schemas';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/dashboard', ctrl.dashboard);
router.get('/revenue', ctrl.revenueSeries);
router.get('/users', ctrl.listUsers);
router.patch('/users/:userId', ctrl.setUserFlag);
router.post('/balance', validate(adminAdjustSchema), ctrl.adjustUserBalance);
router.get('/audit', ctrl.auditLog);

router.post('/game/pause', ctrl.pauseGame);
router.post('/game/force-crash', validate(adminCrashSchema), ctrl.forceCrash);

router.get('/seed', ctrl.seedInfo);
router.post('/seed/rotate', ctrl.rotateActiveSeed);

export default router;
