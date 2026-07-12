import { Router } from 'express';
import * as ctrl from '../controllers/authController';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { sameOrigin } from '../middleware/csrf';
import { authLimiter, registerLimiter } from '../middleware/rateLimit';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  enable2faSchema,
  disable2faSchema,
} from '../validators/schemas';

const router = Router();

router.post('/register', registerLimiter, authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
// Cookie-authenticated routes: same-origin guard blocks CSRF.
router.post('/refresh', sameOrigin, ctrl.refresh);
router.post('/logout', sameOrigin, authenticate, ctrl.logout);
router.get('/verify-email', ctrl.verifyEmail);

// Password reset (rate-limited to deter abuse / enumeration probing).
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), ctrl.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), ctrl.resetPassword);

// Two-factor enrollment (requires an authenticated session).
router.post('/2fa/setup', authenticate, ctrl.setup2fa);
router.post('/2fa/enable', authenticate, validate(enable2faSchema), ctrl.enable2fa);
router.post('/2fa/disable', authenticate, validate(disable2faSchema), ctrl.disable2fa);

export default router;
