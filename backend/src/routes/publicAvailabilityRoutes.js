/**
 * @fileoverview Public availability route definitions.
 *
 * Provides unauthenticated access to view available (unbooked) time slots.
 * Used by the public-facing dashboard for anonymous browsing.
 *
 * @module routes/publicAvailabilityRoutes
 */

import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

/**
 * @openapi
 * /public/availabilities:
 *   get:
 *     tags: [Public]
 *     summary: List unbooked availability slots
 *     description: |
 *       Public endpoint — no authentication required. Returns unbooked
 *       availability slots with optional time-range filters. Used by the
 *       public-facing booking dashboard for anonymous browsing.
 *     parameters:
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: List of unbooked availability slots
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
router.get('/', async (req, res) => {
  const { from, to, limit } = req.query;

  let client;
  try {
    client = await pool.connect();

    let query = `
      SELECT id, staff_id, start_time, end_time, is_booked
      FROM availabilities
      WHERE is_booked = false
    `;
    const params = [];
    let paramIndex = 1;

    if (from) {
      query += ` AND start_time >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND end_time <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    query += ` ORDER BY start_time ASC`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(parseInt(limit, 10));
    }

    const result = await client.query(query, params);

    return res.status(200).json({
      count: result.rows.length,
      availabilities: result.rows,
    });
  } catch (error) {
    console.error('Public list availabilities failed:', error.message);
    return res.status(500).json({ error: 'Internal availability service fault.' });
  } finally {
    if (client) client.release();
  }
});

/**
 * @openapi
 * /public/availabilities/{id}:
 *   get:
 *     tags: [Public]
 *     summary: Get unbooked availability slot by ID
 *     description: |
 *       Public endpoint — no authentication required. Retrieves a single
 *       unbooked availability slot by its UUID.
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
 *         description: Slot not found or already booked
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
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  let client;
  try {
    client = await pool.connect();

    const query = `
      SELECT id, staff_id, start_time, end_time, is_booked
      FROM availabilities
      WHERE id = $1 AND is_booked = false;
    `;
    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Availability slot not found.' });
    }

    return res.status(200).json({ availability: result.rows[0] });
  } catch (error) {
    console.error('Public get availability failed:', error.message);
    return res.status(500).json({ error: 'Internal availability service fault.' });
  } finally {
    if (client) client.release();
  }
});

export default router;
