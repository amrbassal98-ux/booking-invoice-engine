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

/** POST /api/bookings/checkout — Create Stripe PaymentIntent (customer only). */
router.post('/checkout', authorizeRoles('customer'), createCheckoutSession);

/** POST /api/bookings — Direct booking (customer only). */
router.post('/', authorizeRoles('customer'), createBooking);

/** GET /api/bookings — List bookings (any authenticated user, scoped by tenant). */
router.get('/', listBookings);

/** GET /api/bookings/:id — Get single booking with slot + invoice joins. */
router.get('/:id', getBooking);

/** PATCH /api/bookings/:id/status — Update status (tenant_admin, staff). */
router.patch('/:id/status', authorizeRoles('tenant_admin', 'staff'), updateBookingStatus);

export default router;
