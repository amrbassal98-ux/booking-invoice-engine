/**
 * @fileoverview Booking route definitions.
 * All routes require authentication. Checkout and direct booking are
 * restricted to customers. Status updates require admin/staff roles.
 *
 * @module routes/bookingRoutes
 */

import { Router } from 'express';
import {
  createBooking,
  createCheckoutSession,
  getBooking,
  listBookings,
  updateBookingStatus
} from '../controllers/bookingController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

/** All booking routes require authentication. */
router.use(authenticateToken);

/**
 * @openapi
 * /bookings/checkout:
 *   post:
 *     tags: [Bookings]
 *     summary: Create Stripe checkout session
 *     description: |
 *       Creates a Stripe PaymentIntent for a booking. Validates slot availability,
 *       converts the amount to cents, and returns the client secret for frontend
 *       Stripe Elements integration. The PaymentIntent metadata includes booking
 *       details for webhook reconciliation.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [availability_id, total_amount]
 *             properties:
 *               availability_id:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the availability slot to book
 *               total_amount:
 *                 type: number
 *                 format: float
 *                 example: 150.00
 *                 description: Total amount in dollars (must be positive)
 *               currency:
 *                 type: string
 *                 default: USD
 *                 description: Payment currency (ISO 4217)
 *     responses:
 *       201:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientSecret:
 *                   type: string
 *                   description: Stripe client secret for frontend confirmation
 *                 paymentIntentId:
 *                   type: string
 *                   description: Stripe PaymentIntent ID
 *       400:
 *         description: Missing fields or invalid amount
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
 *         description: Insufficient role privileges (requires customer)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Slot not found
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
router.post('/checkout', authorizeRoles('customer'), createCheckoutSession);

/**
 * @openapi
 * /bookings:
 *   post:
 *     tags: [Bookings]
 *     summary: Create direct booking
 *     description: |
 *       Creates a booking and invoice atomically within a transaction.
 *       Locks the availability slot with `FOR UPDATE` to prevent race
 *       conditions. The booking is created with `pending` status.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [availability_id, total_amount]
 *             properties:
 *               availability_id:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the availability slot to book
 *               total_amount:
 *                 type: number
 *                 format: float
 *                 example: 150.00
 *                 description: Total amount in dollars (must be positive)
 *               currency:
 *                 type: string
 *                 default: USD
 *                 description: Payment currency (ISO 4217)
 *     responses:
 *       201:
 *         description: Booking and invoice created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 booking:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Booking'
 *                     - type: object
 *                       properties:
 *                         slot:
 *                           type: object
 *                           properties:
 *                             staff_id:
 *                               type: string
 *                               format: uuid
 *                             start_time:
 *                               type: string
 *                               format: date-time
 *                             end_time:
 *                               type: string
 *                               format: date-time
 *                 invoice:
 *                   $ref: '#/components/schemas/Invoice'
 *       400:
 *         description: Missing fields or invalid amount
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
 *         description: Insufficient role privileges (requires customer)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Slot not found
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
 *   get:
 *     tags: [Bookings]
 *     summary: List bookings
 *     description: |
 *       Lists all bookings for the current tenant. Results are scoped
 *       to the tenant context from the JWT. Supports optional filters.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, cancelled, completed]
 *         description: Filter by booking status
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Created-at lower bound (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Created-at upper bound (ISO 8601)
 *     responses:
 *       200:
 *         description: List of bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of bookings returned
 *                 bookings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Missing or invalid JWT
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
router.post('/', authorizeRoles('customer'), createBooking);
router.get('/', listBookings);

/**
 * @openapi
 * /bookings/{id}:
 *   get:
 *     tags: [Bookings]
 *     summary: Get booking by ID
 *     description: |
 *       Retrieves a single booking with joined slot and invoice data.
 *       Scoped to the caller's tenant context.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking UUID
 *     responses:
 *       200:
 *         description: Booking details with slot and invoice
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 booking:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Booking'
 *                     - type: object
 *                       properties:
 *                         slot:
 *                           type: object
 *                           properties:
 *                             staff_id:
 *                               type: string
 *                               format: uuid
 *                             start_time:
 *                               type: string
 *                               format: date-time
 *                             end_time:
 *                               type: string
 *                               format: date-time
 *                 invoice:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/Invoice'
 *                     - type: 'null'
 *       401:
 *         description: Missing or invalid JWT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Booking not found
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
router.get('/:id', getBooking);

/**
 * @openapi
 * /bookings/{id}/status:
 *   patch:
 *     tags: [Bookings]
 *     summary: Update booking status
 *     description: |
 *       Updates a booking's status with enforced state transitions:
 *       - `pending` → `confirmed`, `cancelled`
 *       - `confirmed` → `completed`, `cancelled`
 *       - `cancelled` / `completed` → terminal (no further updates)
 *
 *       On cancellation, the availability slot is released and the
 *       invoice is voided.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, cancelled, completed]
 *                 description: New booking status
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Invalid status value
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
 *         description: Insufficient role privileges (requires tenant_admin or staff)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Booking already in terminal state
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
router.patch('/:id/status', authorizeRoles('tenant_admin', 'staff'), updateBookingStatus);

export default router;
