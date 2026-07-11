/**
 * @fileoverview Invitation route definitions.
 *
 * - POST /       — Create invitation (authenticated, tenant_admin only).
 * - POST /accept — Accept invitation (public, no auth required).
 *
 * @module routes/invitationRoutes
 */

import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';
import { createInvitation, acceptInvitation } from '../controllers/invitationController.js';

const router = Router();

/** POST /api/invitations — Create invitation (tenant_admin only). */
router.post('/', authenticateToken, authorizeRoles('tenant_admin'), createInvitation);

/** POST /api/invitations/accept — Accept invitation (public endpoint). */
router.post('/accept', acceptInvitation);

export default router;
