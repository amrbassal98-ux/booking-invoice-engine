import { Router } from 'express';
import { registerTenantAdmin } from '../controllers/tenantController.js';

const router = Router();

router.post('/onboard', registerTenantAdmin);

export default router;