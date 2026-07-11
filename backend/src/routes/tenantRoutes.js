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

/**
 * @openapi
 * /tenants/onboard:
 *   post:
 *     tags: [Tenants]
 *     summary: Register new tenant or accept invitation
 *     description: |
 *       Supports two registration flows:
 *
 *       **Direct registration** (no `inviteToken`): Creates a new tenant,
 *       user account with `tenant_admin` role, and returns a JWT.
 *
 *       **Invitation-based** (with `inviteToken`): Validates the invitation
 *       token, creates the user account if new, adds them to the existing
 *       workspace, and returns a JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 description: Direct registration
 *                 required: [tenantName, tenantSlug, email, password]
 *                 properties:
 *                   tenantName:
 *                     type: string
 *                     example: Acme Corp
 *                     description: Organization display name
 *                   tenantSlug:
 *                     type: string
 *                     example: acme-corp
 *                     description: URL-friendly unique identifier
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: admin@acme.com
 *                     description: Admin email address
 *                   password:
 *                     type: string
 *                     format: password
 *                     minLength: 6
 *                     example: securePassword123
 *                     description: Admin password (min 6 characters)
 *                   firstName:
 *                     type: string
 *                     example: John
 *                     description: Admin first name
 *                   lastName:
 *                     type: string
 *                     example: Doe
 *                     description: Admin last name
 *               - type: object
 *                 description: Invitation-based registration
 *                 required: [inviteToken, email, password]
 *                 properties:
 *                   inviteToken:
 *                     type: string
 *                     description: Invitation token from email/link
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: Must match invitation email
 *                   password:
 *                     type: string
 *                     format: password
 *                     minLength: 6
 *                     description: Password for new account
 *                   firstName:
 *                     type: string
 *                     description: First name
 *                   lastName:
 *                     type: string
 *                     description: Last name
 *     responses:
 *       201:
 *         description: Registration completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: Signed JWT (24h expiry)
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 workspaces:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Workspace'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Invitation email mismatch
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Invalid invitation token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Invitation already accepted or duplicate slug/email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       410:
 *         description: Invitation expired
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
router.post('/onboard', registerTenantAdmin);

export default router;
