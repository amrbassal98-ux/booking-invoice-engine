import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';
import { createInvitation, acceptInvitation } from '../controllers/invitationController.js';

const router = Router();

router.post('/', authenticateToken, authorizeRoles('tenant_admin'), createInvitation);
router.post('/accept', acceptInvitation);

export default router;
