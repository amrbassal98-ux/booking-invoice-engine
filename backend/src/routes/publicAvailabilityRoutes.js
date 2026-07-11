import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

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
