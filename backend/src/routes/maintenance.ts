import { Router } from 'express';
import { getMaintenance } from '../controllers/maintenanceController';

const router = Router();

// Public read-only maintenance state. Writes go through /api/admin/config.
router.get('/', getMaintenance);

export default router;
