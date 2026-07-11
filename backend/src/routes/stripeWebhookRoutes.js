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
 * @openapi
 * /webhooks/stripe:
 *   post:
 *     tags: [Webhooks]
 *     summary: Stripe webhook receiver
 *     description: |
 *       Receives and processes Stripe webhook events for payment confirmation.
 *       The raw request body is preserved for Stripe signature verification.
 *
 *       Supported event types:
 *       - `payment_intent.succeeded` — Creates a confirmed booking
 *       - `checkout.session.completed` — Creates a confirmed booking
 *
 *       When a payment succeeds, the handler atomically locks the availability
 *       slot, creates a confirmed booking, marks the slot as booked, and
 *       creates a corresponding invoice.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Raw Stripe event payload
 *           example:
 *             type: payment_intent.succeeded
 *             data:
 *               object:
 *                 id: pi_3abc123def456
 *                 metadata:
 *                   tenant_id: "1"
 *                   slot_id: "uuid-here"
 *                   customer_id: "uuid-here"
 *                   total_amount: "150.00"
 *                   currency: USD
 *     responses:
 *       200:
 *         description: Event received (processed or acknowledged)
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: Successfully processed
 *                   properties:
 *                     received:
 *                       type: boolean
 *                     booking:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         status:
 *                           type: string
 *                         total_amount:
 *                           type: number
 *                         currency:
 *                           type: string
 *                     invoice:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         status:
 *                           type: string
 *                         amount_due:
 *                           type: number
 *                 - type: object
 *                   description: Unhandled event type acknowledged
 *                   properties:
 *                     received:
 *                       type: boolean
 *                     message:
 *                       type: string
 *       400:
 *         description: Missing signature or verification failure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Slot not found in metadata
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Slot already booked
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
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
