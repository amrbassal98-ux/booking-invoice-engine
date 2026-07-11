/**
 * @fileoverview Tenant onboarding route definitions.
 * Maps POST /onboard to the tenant registration controller.
 * This is a public endpoint — no authentication required.
 *
 * @module routes/tenantRoutes
 */

import { Router } from 'express';
import { registerTenantAdmin } from '../controllers/tenantController.js';

const router = Router();

/** POST /api/tenants/onboard — Register new tenant or accept invitation. */
router.post('/onboard', registerTenantAdmin);

export default router;
