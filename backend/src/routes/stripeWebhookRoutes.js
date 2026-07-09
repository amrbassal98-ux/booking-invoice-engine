import { Router } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../controllers/stripeWebhookController.js';

const router = Router();

router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
