import { Router } from 'express';
import * as ctrl from '../controllers/tournamentController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listPublic);
router.get('/:id', ctrl.detail);

export default router;
