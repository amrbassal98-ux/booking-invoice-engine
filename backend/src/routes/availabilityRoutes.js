/**
 * @fileoverview Availability slot route definitions.
 * All routes require authentication. Mutating routes are restricted to
 * tenant_admin and provider roles via RBAC middleware.
 *
 * @module routes/availabilityRoutes
 */

import { Router } from 'express';
import {
  createAvailability,
  listAvailabilities,
  getAvailability,
  updateAvailability,
  deleteAvailability
} from '../controllers/availabilityController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

/** All availability routes require authentication. */
router.use(authenticateToken);

/** POST /api/availabilities — Create slot (tenant_admin, provider). */
router.post('/', authorizeRoles('tenant_admin', 'provider'), createAvailability);

/** GET /api/availabilities — List slots (any authenticated user, scoped by role). */
router.get('/', listAvailabilities);

/** GET /api/availabilities/:id — Get single slot. */
router.get('/:id', getAvailability);

/** PUT /api/availabilities/:id — Update slot (tenant_admin, provider). */
router.put('/:id', authorizeRoles('tenant_admin', 'provider'), updateAvailability);

/** DELETE /api/availabilities/:id — Delete slot (tenant_admin, provider). */
router.delete('/:id', authorizeRoles('tenant_admin', 'provider'), deleteAvailability);

export default router;
