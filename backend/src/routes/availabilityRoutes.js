/**
 * @fileoverview Availability slot route definitions.
 * All routes require authentication. Mutating routes are restricted to
 * tenant_admin and provider roles via RBAC middleware.
 *
 * @module routes/availabilityRoutes
 */

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

/** All availability routes require authentication. */
router.use(authenticateToken);

/**
 * @openapi
 * /availabilities:
 *   post:
 *     tags: [Availabilities]
 *     summary: Create availability slot
 *     description: |
 *       Creates a new time slot for a staff member. Providers can only
 *       create slots for themselves. Overlapping unbooked slots are rejected.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start_time, end_time]
 *             properties:
 *               staff_id:
 *                 type: string
 *                 format: uuid
 *                 description: Staff user ID (required for admin, auto-set for provider)
 *               start_time:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-07-15T09:00:00Z
 *                 description: Slot start time (ISO 8601)
 *               end_time:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-07-15T10:00:00Z
 *                 description: Slot end time (must be after start_time)
 *     responses:
 *       201:
 *         description: Slot created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 availability:
 *                   $ref: '#/components/schemas/AvailabilitySlot'
 *       400:
 *         description: Missing fields or invalid time range
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Provider attempting to create slot for another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Slot overlaps with existing unbooked availability
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
 *     tags: [Availabilities]
 *     summary: List availability slots
 *     description: |
 *       Lists slots scoped to the caller's tenant and role.
 *       - Providers see only their own slots
 *       - Customers see only unbooked slots
 *       - Admins/staff see all slots with optional filters
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: staff_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by staff member ID
 *       - in: query
 *         name: is_booked
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filter by booking status
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time lower bound (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time upper bound (ISO 8601)
 *     responses:
 *       200:
 *         description: List of availability slots
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of slots returned
 *                 availabilities:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AvailabilitySlot'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authorizeRoles('tenant_admin', 'provider'), createAvailability);
router.get('/', listAvailabilities);

/**
 * @openapi
 * /availabilities/{id}:
 *   get:
 *     tags: [Availabilities]
 *     summary: Get availability slot by ID
 *     description: Retrieves a single slot scoped to the caller's tenant.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Slot UUID
 *     responses:
 *       200:
 *         description: Slot details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 availability:
 *                   $ref: '#/components/schemas/AvailabilitySlot'
 *       404:
 *         description: Slot not found
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
 *   put:
 *     tags: [Availabilities]
 *     summary: Update availability slot
 *     description: |
 *       Updates an existing slot. Uses row-level locking to prevent
 *       concurrent modifications. Providers can only edit their own slots.
 *       Booked slots cannot be modified.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Slot UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               staff_id:
 *                 type: string
 *                 format: uuid
 *                 description: New staff member (admin only)
 *               start_time:
 *                 type: string
 *                 format: date-time
 *                 description: New start time
 *               end_time:
 *                 type: string
 *                 format: date-time
 *                 description: New end time
 *     responses:
 *       200:
 *         description: Slot updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 availability:
 *                   $ref: '#/components/schemas/AvailabilitySlot'
 *       400:
 *         description: Invalid time range
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Provider attempting to edit another's slot
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
 *         description: Slot is booked or overlaps
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
 *   delete:
 *     tags: [Availabilities]
 *     summary: Delete availability slot
 *     description: |
 *       Deletes a slot. Uses row-level locking. Providers can only
 *       delete their own slots. Booked slots cannot be deleted.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Slot UUID
 *     responses:
 *       200:
 *         description: Slot deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Availability slot deleted successfully.
 *       403:
 *         description: Provider attempting to delete another's slot
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
 *         description: Slot is booked
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
router.get('/:id', getAvailability);
router.put('/:id', authorizeRoles('tenant_admin', 'provider'), updateAvailability);
router.delete('/:id', authorizeRoles('tenant_admin', 'provider'), deleteAvailability);

export default router;
