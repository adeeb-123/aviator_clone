import { Router } from 'express';
import * as ctrl from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { depositSchema, withdrawSchema } from '../validators/schemas';

const router = Router();

router.post('/checkout', authenticate, validate(depositSchema), ctrl.createCheckout);
router.post('/confirm', authenticate, ctrl.confirmCheckout);
router.post('/withdraw', authenticate, validate(withdrawSchema), ctrl.withdraw);

export default router;
