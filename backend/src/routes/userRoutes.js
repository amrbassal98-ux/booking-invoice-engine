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

/**
 * @openapi
 * /users/providers:
 *   get:
 *     tags: [Users]
 *     summary: List providers and staff
 *     description: |
 *       Returns all users with `provider` or `staff` roles in the current
 *       tenant workspace. Restricted to `tenant_admin` role. Used by admin
 *       dashboards to populate staff/provider dropdowns.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of providers and staff members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of providers returned
 *                 providers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Missing or invalid JWT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Insufficient role privileges (requires tenant_admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/providers', authenticateToken, authorizeRoles('tenant_admin'), listProviders);

export default router;
