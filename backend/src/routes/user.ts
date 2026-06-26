import { Router } from 'express';
import * as ctrl from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateProfileSchema, favoriteSchema, transferSchema } from '../validators/schemas';

const router = Router();
router.use(authenticate);

router.get('/me', ctrl.me);
router.patch('/me', validate(updateProfileSchema), ctrl.updateProfile);
router.get('/stats', ctrl.getStats);
router.post('/daily-claim', ctrl.claimDaily);
router.get('/vip', ctrl.getVip);
router.post('/cashback', ctrl.claimCashback);
router.get('/referrals', ctrl.getReferrals);
router.get('/quests', ctrl.getQuests);
router.post('/quests/:id/claim', ctrl.claimQuest);
router.get('/spin', ctrl.getSpin);
router.post('/spin', ctrl.doSpin);
router.post('/redeem', ctrl.redeemPromo);
router.post('/badges/:id/claim', ctrl.claimBadge);
router.get('/profile/:username', ctrl.getPublicProfile);
router.post('/rain', ctrl.rain);
router.get('/bets', ctrl.getBetHistory);
router.get('/transactions', ctrl.getTransactions);
router.get('/favorites', ctrl.getFavorites);
router.post('/favorites', validate(favoriteSchema), ctrl.addFavorite);
router.delete('/favorites/:name', ctrl.removeFavorite);
router.post('/transfer', validate(transferSchema), ctrl.transfer);

export default router;
