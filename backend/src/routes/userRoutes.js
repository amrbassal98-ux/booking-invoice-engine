/**
 * @fileoverview User directory route definitions.
 * All routes require authentication and role-based authorization.
 *
 * @module routes/userRoutes
 */

import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';
import { listProviders } from '../controllers/userController.js';

const router = Router();

/** GET /api/users/providers — List providers/staff (tenant_admin only). */
router.get('/providers', authenticateToken, authorizeRoles('tenant_admin'), listProviders);

export default router;
