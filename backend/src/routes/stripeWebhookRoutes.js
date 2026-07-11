/**
 * @fileoverview Stripe webhook route definition.
 *
 * Mounts the webhook endpoint with `express.raw()` body parser to preserve
 * the raw request body for Stripe signature verification. This route is
 * mounted BEFORE the global `express.json()` parser in app.js.
 *
 * @module routes/stripeWebhookRoutes
 */

import { Router } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../controllers/stripeWebhookController.js';

const router = Router();

/**
 * POST /api/webhooks/stripe — Stripe event receiver.
 * Uses raw body parser for signature verification.
 */
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
