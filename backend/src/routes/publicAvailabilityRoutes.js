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
 * GET /api/public/availabilities
 *
 * Lists unbooked availability slots with optional time-range filters.
 * No authentication required — this is a public endpoint.
 *
 * @query   {string} [from]  - Start time lower bound (ISO 8601)
 * @query   {string} [to]    - End time upper bound (ISO 8601)
 * @query   {string} [limit] - Maximum number of results
 * @returns {object} 200 - { count, availabilities }
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
 * GET /api/public/availabilities/:id
 *
 * Retrieves a single unbooked availability slot by ID.
 * No authentication required.
 *
 * @param   {string} id - Slot UUID from URL params
 * @returns {object} 200 - { availability } or 404
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
