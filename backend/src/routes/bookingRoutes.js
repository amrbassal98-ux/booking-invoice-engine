import { Router } from 'express';
import {
  createBooking,
  getBooking,
  listBookings,
  updateBookingStatus
} from '../controllers/bookingController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticateToken);

router.post('/', authorizeRoles('customer', 'tenant_admin'), createBooking);
router.get('/', listBookings);
router.get('/:id', getBooking);
router.patch('/:id/status', authorizeRoles('tenant_admin', 'staff'), updateBookingStatus);

export default router;
