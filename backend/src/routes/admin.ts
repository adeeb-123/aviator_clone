import { Router } from 'express';
import * as ctrl from '../controllers/adminController';
import * as analytics from '../controllers/analyticsController';
import * as alerts from '../controllers/alertController';
import * as tournaments from '../controllers/tournamentController';
import * as crypto from '../controllers/cryptoController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { adminAdjustSchema, adminCrashSchema } from '../validators/schemas';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/dashboard', ctrl.dashboard);
router.get('/revenue', ctrl.revenueSeries);

// ── advanced analytics ──
router.get('/analytics/overview', analytics.overview);
router.get('/analytics/timeseries', analytics.timeseries);
router.get('/analytics/rounds', analytics.rounds);
router.get('/analytics/players', analytics.players);
router.get('/analytics/players/:userId', analytics.playerDetail);

// ── alerts ──
router.get('/alerts', alerts.list);
router.post('/alerts/read-all', alerts.markAllRead);
router.post('/alerts/:id/read', alerts.markRead);
router.get('/alerts/config', alerts.getConfig);
router.patch('/alerts/config', alerts.setConfig);
router.get('/users', ctrl.listUsers);
router.patch('/users/:userId', ctrl.setUserFlag);
router.post('/users/:userId/mute', ctrl.muteUser);
router.post('/balance', validate(adminAdjustSchema), ctrl.adjustUserBalance);
router.get('/audit', ctrl.auditLog);

// ── runtime config, admin-action log, broadcast & moderation ──
router.get('/config', ctrl.getConfig);
router.patch('/config', ctrl.setConfig);
router.get('/jackpot', ctrl.getJackpot);
router.post('/jackpot', ctrl.setJackpot);
router.get('/actions', ctrl.adminActions);
router.post('/broadcast', ctrl.broadcast);
router.delete('/chat/:id', ctrl.deleteChatMessage);

// ── promo / bonus codes ──
router.get('/promos', ctrl.listPromos);
router.post('/promos', ctrl.createPromo);
router.patch('/promos/:id', ctrl.updatePromo);

// ── tournaments ──
router.get('/tournaments', tournaments.adminList);
router.post('/tournaments', tournaments.adminCreate);
router.post('/tournaments/:id/end', tournaments.adminEnd);
router.delete('/tournaments/:id', tournaments.adminDelete);

// ── crypto withdrawal approval queue ──
router.get('/crypto/withdrawals', crypto.adminListWithdrawals);
router.post('/crypto/withdrawals/:id/approve', crypto.adminApprove);
router.post('/crypto/withdrawals/:id/reject', crypto.adminReject);

router.get('/game/status', ctrl.gameStatus);
router.post('/game/pause', ctrl.pauseGame);
router.post('/game/force-crash', validate(adminCrashSchema), ctrl.forceCrash);
router.post('/game/clear-crash', ctrl.clearForceCrash);
router.post('/game/reorder-crash', ctrl.reorderForceCrash);

router.get('/seed', ctrl.seedInfo);
router.post('/seed/rotate', ctrl.rotateActiveSeed);

export default router;
