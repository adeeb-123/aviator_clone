import { Router } from 'express';
import * as ctrl from '../controllers/authController';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authLimiter, registerLimiter } from '../middleware/rateLimit';
import { registerSchema, loginSchema } from '../validators/schemas';

const router = Router();

router.post('/register', registerLimiter, authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.get('/verify-email', ctrl.verifyEmail);

export default router;
