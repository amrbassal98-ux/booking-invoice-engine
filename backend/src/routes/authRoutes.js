/**
 * @fileoverview Authentication route definitions.
 * Maps POST /login to the login controller.
 *
 * @module routes/authRoutes
 */

import { Router } from 'express';
import { loginUser } from '../controllers/authController.js';

const router = Router();

/** POST /api/auth/login — Authenticate user and return JWT. */
router.post('/login', loginUser);

export default router;
