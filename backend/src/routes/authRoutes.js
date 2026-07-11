/**
 * @fileoverview Authentication route definitions.
 * Maps POST /login to the login controller.
 *
 * @module routes/authRoutes
 */

import { Router } from 'express';
import { loginUser } from '../controllers/authController.js';

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate user and return JWT
 *     description: |
 *       Validates email/password credentials against the `users` table,
 *       resolves tenant workspaces, and returns a signed JWT scoped to
 *       the primary workspace.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *                 description: User email address
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securePassword123
 *                 description: User password
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Authentication successful.
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
 *         description: Missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: No tenant workspace assigned
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
router.post('/login', loginUser);

export default router;
