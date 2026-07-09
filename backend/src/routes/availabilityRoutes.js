import { Router } from 'express';
import {
  createAvailability,
  listAvailabilities,
  getAvailability,
  updateAvailability,
  deleteAvailability
} from '../controllers/availabilityController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticateToken);

router.post('/', authorizeRoles('tenant_admin', 'provider'), createAvailability);
router.get('/', listAvailabilities);
router.get('/:id', getAvailability);
router.put('/:id', authorizeRoles('tenant_admin', 'provider'), updateAvailability);
router.delete('/:id', authorizeRoles('tenant_admin', 'provider'), deleteAvailability);

export default router;
