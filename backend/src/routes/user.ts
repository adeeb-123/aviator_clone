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
router.get('/bets', ctrl.getBetHistory);
router.get('/transactions', ctrl.getTransactions);
router.get('/favorites', ctrl.getFavorites);
router.post('/favorites', validate(favoriteSchema), ctrl.addFavorite);
router.delete('/favorites/:name', ctrl.removeFavorite);
router.post('/transfer', validate(transferSchema), ctrl.transfer);

export default router;
