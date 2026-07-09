import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';
import { listProviders } from '../controllers/userController.js';

const router = Router();

router.get('/providers', authenticateToken, authorizeRoles('tenant_admin'), listProviders);

export default router;
