import { Router } from 'express';
import * as ctrl from '../controllers/gameController';
import { validate } from '../middleware/validate';
import { verifyRoundSchema } from '../validators/schemas';

const router = Router();

router.get('/state', ctrl.getState);
router.get('/history', ctrl.getHistory);
router.get('/stats', ctrl.getStats);
router.get('/rtp', ctrl.getRtp);
router.get('/leaderboard', ctrl.leaderboard);
router.get('/round/:roundId', ctrl.getRound);

// provably fair (public)
router.get('/verify', validate(verifyRoundSchema, 'query'), ctrl.verify);
router.get('/seeds', ctrl.getRevealedSeeds);

export default router;
