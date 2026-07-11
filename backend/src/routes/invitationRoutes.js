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

/**
 * @openapi
 * /invitations:
 *   post:
 *     tags: [Invitations]
 *     summary: Create workspace invitation
 *     description: |
 *       Generates a token-based invitation for the given email and role
 *       within the current tenant workspace. Requires `tenant_admin` role.
 *
 *       If the user already exists, checks for duplicate membership.
 *       If a pending invite already exists for the same email/tenant,
 *       it is replaced. The invitation token expires after 7 days.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: colleague@example.com
 *                 description: Invitee email address
 *               role:
 *                 type: string
 *                 enum: [provider, staff, customer]
 *                 default: provider
 *                 description: Role to assign upon acceptance
 *     responses:
 *       201:
 *         description: Invitation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 invitation:
 *                   $ref: '#/components/schemas/Invitation'
 *       400:
 *         description: Missing email or invalid format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *       409:
 *         description: User already a member of this workspace
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
router.post('/', authenticateToken, authorizeRoles('tenant_admin'), createInvitation);

/**
 * @openapi
 * /invitations/accept:
 *   post:
 *     tags: [Invitations]
 *     summary: Accept invitation
 *     description: |
 *       Accepts a pending invitation by token. If the invitee already has
 *       an account, they are added to the workspace. If not, a new account
 *       is created (password required). Returns a JWT for new account
 *       registrations. The invitation token expires after 7 days.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Invitation token from email/link
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Required for new account creation
 *               firstName:
 *                 type: string
 *                 description: First name (new accounts only)
 *               lastName:
 *                 type: string
 *                 description: Last name (new accounts only)
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tenant_id:
 *                   type: integer
 *                 token:
 *                   type: string
 *                   description: JWT (only returned for new account registrations)
 *                 workspaces:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Workspace'
 *       400:
 *         description: Missing token or password (new accounts)
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
 *         description: Invitation already accepted
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
router.post('/accept', acceptInvitation);

export default router;
