import { Router } from 'express';
import * as ctrl from '../controllers/cryptoController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/coins', ctrl.getCoins);
router.post('/deposit', ctrl.deposit);
router.post('/withdraw', ctrl.withdraw);
router.get('/history', ctrl.history);

export default router;
