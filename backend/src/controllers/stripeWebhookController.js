/**
 * @fileoverview Stripe webhook handler.
 *
 * Processes incoming Stripe webhook events for payment confirmation.
 * Supports both `payment_intent.succeeded` and `checkout.session.completed`
 * event types.
 *
 * When a payment succeeds, the handler atomically:
 *   1. Locks and validates the target availability slot
 *   2. Creates a confirmed booking record
 *   3. Marks the slot as booked
 *   4. Creates a corresponding invoice
 *
 * Signature verification is enforced unless SKIP_WEBHOOK_SIGNATURE=true
 * (for local development only).
 *
 * @module controllers/stripeWebhookController
 */

import Stripe from 'stripe';
import pool from '../config/db.js';

/** Lazy-initialized Stripe SDK client (singleton). */
let _stripe;
const getStripe = () => {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
};

/** Webhook signing secret — required for production signature verification. */
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/** When true, skips signature verification (development/testing only). */
const SKIP_SIGNATURE = process.env.SKIP_WEBHOOK_SIGNATURE === 'true';

/**
 * POST /api/webhooks/stripe
 *
 * Receives and processes Stripe webhook events. The raw request body is
 * preserved for signature verification via `express.raw()` middleware.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @response {object} 200 - Event received (processed or acknowledged)
 * @response {object} 400 - Missing signature or verification failure
 * @response {object} 404 - Slot not found in metadata
 * @response {object} 409 - Slot already booked
 */
export const handleStripeWebhook = async (req, res) => {
  let event;

  if (SKIP_SIGNATURE) {
    /** Development mode — parse body directly without verification. */
    if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(new TextDecoder().decode(req.body));
    } else if (typeof req.body === 'string') {
      event = JSON.parse(req.body);
    } else if (typeof req.body === 'object' && req.body !== null) {
      event = req.body;
    } else {
      return res.status(400).json({ error: "Invalid request body type." });
    }
  } else {
    /** Production mode — verify Stripe webhook signature. */
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return res.status(400).json({ error: "Missing stripe-signature header." });
    }

    try {
      event = getStripe().webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }
  }

  /** Acknowledge unhandled event types without processing. */
  if (event.type !== 'payment_intent.succeeded' && event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, message: `Unhandled event type: ${event.type}` });
  }

  /** Extract booking metadata from the Stripe event. */
  const metadata = event.data.object.metadata;

  const { tenant_id, slot_id, customer_id, total_amount, currency } = metadata;

  if (!tenant_id || !slot_id || !customer_id || !total_amount) {
    console.error("Stripe webhook missing required metadata:", metadata);
    return res.status(400).json({ error: "Webhook event is missing required metadata keys." });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    /** Lock the slot row to prevent concurrent bookings. */
    const slotQuery = `
      SELECT id, tenant_id, staff_id, start_time, end_time, is_booked
      FROM availabilities
      WHERE id = $1 AND tenant_id = $2
      FOR UPDATE;
    `;
    const slotResult = await client.query(slotQuery, [slot_id, tenant_id]);

    if (slotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Availability slot not found." });
    }

    const slot = slotResult.rows[0];

    if (slot.is_booked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: "Conflict: Availability slot is already booked." });
    }

    /** Create confirmed booking — status set to 'confirmed' directly (payment already succeeded). */
    const bookingQuery = `
      INSERT INTO bookings (tenant_id, customer_id, availability_id, status, total_amount, currency)
      VALUES ($1, $2, $3, 'confirmed', $4, $5)
      RETURNING id, tenant_id, customer_id, availability_id, status, total_amount, currency, created_at;
    `;
    const bookingResult = await client.query(bookingQuery, [
      tenant_id,
      customer_id,
      slot_id,
      total_amount,
      currency || 'USD'
    ]);
    const newBooking = bookingResult.rows[0];

    /** Mark the availability slot as booked. */
    const updateSlotQuery = `
      UPDATE availabilities
      SET is_booked = true
      WHERE id = $1 AND tenant_id = $2;
    `;
    await client.query(updateSlotQuery, [slot_id, tenant_id]);

    /** Create a corresponding invoice record. */
    const invoiceQuery = `
      INSERT INTO invoices (tenant_id, booking_id, amount_due)
      VALUES ($1, $2, $3)
      RETURNING id, tenant_id, booking_id, status, amount_due, amount_paid, created_at;
    `;
    const invoiceResult = await client.query(invoiceQuery, [
      tenant_id,
      newBooking.id,
      total_amount
    ]);
    const newInvoice = invoiceResult.rows[0];

    await client.query('COMMIT');

    return res.status(200).json({
      received: true,
      booking: {
        id: newBooking.id,
        status: newBooking.status,
        total_amount: newBooking.total_amount,
        currency: newBooking.currency
      },
      invoice: {
        id: newInvoice.id,
        status: newInvoice.status,
        amount_due: newInvoice.amount_due
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Stripe webhook transaction aborted:", error.message);
    return res.status(500).json({ error: "Internal webhook processing fault." });
  } finally {
    client.release();
  }
};
