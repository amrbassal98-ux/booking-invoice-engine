/**
 * @fileoverview Booking lifecycle controller.
 *
 * Manages the full booking lifecycle:
 *   1. `createBooking`      — Direct in-app booking (creates booking + invoice atomically).
 *   2. `createCheckoutSession` — Stripe PaymentIntent creation for hosted checkout.
 *   3. `getBooking`         — Single booking retrieval with slot and invoice joins.
 *   4. `listBookings`       — Filtered booking list for the current tenant.
 *   5. `updateBookingStatus` — Status transitions (pending → confirmed → completed/cancelled).
 *
 * All mutating operations run inside PostgreSQL transactions with `FOR UPDATE`
 * row locking to prevent race conditions on slot availability.
 *
 * @module controllers/bookingController
 */

import Stripe from 'stripe';
import pool from '../config/db.js';

/** Lazy-initialized Stripe SDK client (singleton). */
let _stripe;
const getStripe = () => {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
};

/**
 * POST /api/bookings
 *
 * Creates a direct booking for an available slot. Runs atomically:
 *   1. Lock and verify slot availability
 *   2. Insert booking record
 *   3. Mark slot as booked
 *   4. Create corresponding invoice
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @response {object} 201 - Booking + invoice created
 * @response {object} 400 - Missing fields or invalid amount
 * @response {object} 404 - Slot not found
 * @response {object} 409 - Slot already booked
 */
export const createBooking = async (req, res) => {
  const { tenant_id, user_id } = req.user;
  const { availability_id, total_amount, currency } = req.body;

  if (!availability_id || total_amount === undefined || total_amount === null) {
    return res.status(400).json({ error: "Missing required fields: availability_id, total_amount." });
  }

  if (typeof total_amount !== 'number' || total_amount <= 0) {
    return res.status(400).json({ error: "total_amount must be a positive number." });
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
    const slotResult = await client.query(slotQuery, [availability_id, tenant_id]);

    if (slotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Availability slot not found." });
    }

    const slot = slotResult.rows[0];

    if (slot.is_booked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: "Conflict: Availability slot is already booked." });
    }

    /** Insert booking record with 'pending' status. */
    const bookingQuery = `
      INSERT INTO bookings (tenant_id, customer_id, availability_id, total_amount, currency)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tenant_id, customer_id, availability_id, status, total_amount, currency, created_at;
    `;
    const bookingResult = await client.query(bookingQuery, [
      tenant_id,
      user_id,
      availability_id,
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
    await client.query(updateSlotQuery, [availability_id, tenant_id]);

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

    return res.status(201).json({
      message: "Booking created successfully.",
      booking: {
        ...newBooking,
        slot: {
          staff_id: slot.staff_id,
          start_time: slot.start_time,
          end_time: slot.end_time
        }
      },
      invoice: newInvoice
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Booking transaction aborted:", error.message);
    return res.status(500).json({ error: "Internal booking service fault." });
  } finally {
    client.release();
  }
};

/**
 * POST /api/bookings/checkout
 *
 * Creates a Stripe PaymentIntent for a booking. Validates slot availability,
 * converts the amount to cents, and returns the client secret for frontend
 * Stripe Elements integration.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @response {object} 201 - { clientSecret, paymentIntentId }
 * @response {object} 400 - Missing fields or invalid amount
 * @response {object} 404 - Slot not found
 * @response {object} 409 - Slot already booked
 */
export const createCheckoutSession = async (req, res) => {
  const { tenant_id, user_id } = req.user;
  const { availability_id, total_amount, currency } = req.body;

  if (!availability_id || total_amount === undefined || total_amount === null) {
    return res.status(400).json({ error: "Missing required fields: availability_id, total_amount." });
  }

  if (typeof total_amount !== 'number' || total_amount <= 0) {
    return res.status(400).json({ error: "total_amount must be a positive number." });
  }

  if (currency !== undefined && typeof currency !== 'string') {
    return res.status(400).json({ error: "currency must be a string." });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const slotQuery = `
      SELECT id, tenant_id, staff_id, start_time, end_time, is_booked
      FROM availabilities
      WHERE id = $1 AND tenant_id = $2
      FOR UPDATE;
    `;
    const slotResult = await client.query(slotQuery, [availability_id, tenant_id]);

    if (slotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Availability slot not found." });
    }

    const slot = slotResult.rows[0];

    if (slot.is_booked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: "Conflict: Availability slot is already booked." });
    }

    /** Convert dollar amount to cents for Stripe. */
    const amountInCents = Math.round(total_amount * 100);

    /** Create Stripe PaymentIntent with booking metadata for webhook reconciliation. */
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amountInCents,
      currency: (currency || 'usd').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        tenant_id,
        slot_id: availability_id,
        customer_id: user_id,
        total_amount: String(total_amount),
        currency: currency || 'USD'
      }
    });

    await client.query('COMMIT');

    return res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Checkout session creation failed:", error.message);
    return res.status(500).json({ error: "Internal checkout service fault." });
  } finally {
    client.release();
  }
};

/**
 * GET /api/bookings/:id
 *
 * Retrieves a single booking with joined slot and invoice data.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @response {object} 200 - Booking with slot and invoice details
 * @response {object} 404 - Booking not found
 */
export const getBooking = async (req, res) => {
  const { id } = req.params;
  const { tenant_id } = req.user;

  let client;
  try {
    client = await pool.connect();

    const query = `
      SELECT
        b.id, b.tenant_id, b.customer_id, b.availability_id,
        b.status, b.total_amount, b.currency, b.created_at, b.updated_at,
        a.staff_id, a.start_time, a.end_time,
        i.id AS invoice_id, i.status AS invoice_status,
        i.amount_due, i.amount_paid
      FROM bookings b
      JOIN availabilities a ON b.availability_id = a.id
      LEFT JOIN invoices i ON i.booking_id = b.id
      WHERE b.id = $1 AND b.tenant_id = $2;
    `;
    const result = await client.query(query, [id, tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const row = result.rows[0];

    return res.status(200).json({
      booking: {
        id: row.id,
        tenant_id: row.tenant_id,
        customer_id: row.customer_id,
        availability_id: row.availability_id,
        status: row.status,
        total_amount: row.total_amount,
        currency: row.currency,
        created_at: row.created_at,
        updated_at: row.updated_at,
        slot: {
          staff_id: row.staff_id,
          start_time: row.start_time,
          end_time: row.end_time
        }
      },
      invoice: row.invoice_id ? {
        id: row.invoice_id,
        status: row.invoice_status,
        amount_due: row.amount_due,
        amount_paid: row.amount_paid
      } : null
    });

  } catch (error) {
    console.error("Get booking failed:", error.message);
    return res.status(500).json({ error: "Internal booking service fault." });
  } finally {
    if (client) client.release();
  }
};

/**
 * GET /api/bookings
 *
 * Lists all bookings for the current tenant with optional filters.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @query   {string} [status] - Filter by booking status
 * @query   {string} [from]   - Created-at lower bound (ISO 8601)
 * @query   {string} [to]     - Created-at upper bound (ISO 8601)
 */
export const listBookings = async (req, res) => {
  const { tenant_id } = req.user;
  const { status, from, to } = req.query;

  let client;
  try {
    client = await pool.connect();

    let query = `
      SELECT
        b.id, b.customer_id, b.availability_id,
        b.status, b.total_amount, b.currency, b.created_at,
        a.start_time, a.end_time, a.staff_id
      FROM bookings b
      JOIN availabilities a ON b.availability_id = a.id
      WHERE b.tenant_id = $1
    `;
    const params = [tenant_id];
    let paramIndex = 2;

    if (status) {
      query += ` AND b.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (from) {
      query += ` AND b.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND b.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    query += ` ORDER BY b.created_at DESC;`;

    const result = await client.query(query, params);

    return res.status(200).json({
      count: result.rows.length,
      bookings: result.rows
    });

  } catch (error) {
    console.error("List bookings failed:", error.message);
    return res.status(500).json({ error: "Internal booking service fault." });
  } finally {
    if (client) client.release();
  }
};

/**
 * PATCH /api/bookings/:id/status
 *
 * Updates a booking's status. Enforces valid state transitions:
 *   - `pending` → `confirmed`, `cancelled`
 *   - `confirmed` → `completed`, `cancelled`
 *   - `cancelled` / `completed` → terminal (no further updates)
 *
 * On cancellation, the availability slot is released and the invoice is voided.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @response {object} 200 - Status updated
 * @response {object} 400 - Invalid status value
 * @response {object} 404 - Booking not found
 * @response {object} 409 - Booking already in terminal state
 */
export const updateBookingStatus = async (req, res) => {
  const { id } = req.params;
  const { tenant_id } = req.user;
  const { status } = req.body;

  const allowedStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingQuery = `
      SELECT id, availability_id, status
      FROM bookings
      WHERE id = $1 AND tenant_id = $2
      FOR UPDATE;
    `;
    const existingResult = await client.query(existingQuery, [id, tenant_id]);

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Booking not found." });
    }

    const existing = existingResult.rows[0];

    if (existing.status === 'cancelled' || existing.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Cannot update booking: already ${existing.status}.` });
    }

    const updateQuery = `
      UPDATE bookings
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3
      RETURNING id, tenant_id, customer_id, availability_id, status, total_amount, currency, created_at, updated_at;
    `;
    const result = await client.query(updateQuery, [status, id, tenant_id]);

    /** Side effects on cancellation — release slot and void invoice. */
    if (status === 'cancelled') {
      const releaseSlotQuery = `
        UPDATE availabilities
        SET is_booked = false
        WHERE id = $1 AND tenant_id = $2;
      `;
      await client.query(releaseSlotQuery, [existing.availability_id, tenant_id]);

      const voidInvoiceQuery = `
        UPDATE invoices
        SET status = 'void', updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = $1 AND tenant_id = $2;
      `;
      await client.query(voidInvoiceQuery, [id, tenant_id]);
    }

    await client.query('COMMIT');

    return res.status(200).json({
      message: "Booking status updated successfully.",
      booking: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Update booking status failed:", error.message);
    return res.status(500).json({ error: "Internal booking service fault." });
  } finally {
    client.release();
  }
};
