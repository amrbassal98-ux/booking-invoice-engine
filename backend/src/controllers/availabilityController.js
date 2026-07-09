import pool from '../config/db.js';

export const createAvailability = async (req, res) => {
  const { staff_id, start_time, end_time } = req.body;
  const { tenant_id } = req.user;

  if (!staff_id || !start_time || !end_time) {
    return res.status(400).json({ error: "Missing required fields: staff_id, start_time, end_time." });
  }

  if (new Date(end_time) <= new Date(start_time)) {
    return res.status(400).json({ error: "end_time must be after start_time." });
  }

  let client;
  try {
    client = await pool.connect();

    const overlapQuery = `
      SELECT id FROM availabilities
      WHERE tenant_id = $1
        AND staff_id = $2
        AND is_booked = false
        AND start_time < $4
        AND end_time > $3;
    `;
    const overlapResult = await client.query(overlapQuery, [tenant_id, staff_id, start_time, end_time]);

    if (overlapResult.rows.length > 0) {
      return res.status(409).json({ error: "Conflict: Slot overlaps with an existing unbooked availability." });
    }

    const insertQuery = `
      INSERT INTO availabilities (tenant_id, staff_id, start_time, end_time)
      VALUES ($1, $2, $3, $4)
      RETURNING id, tenant_id, staff_id, start_time, end_time, is_booked;
    `;
    const result = await client.query(insertQuery, [tenant_id, staff_id, start_time, end_time]);

    return res.status(201).json({
      message: "Availability slot created successfully.",
      availability: result.rows[0]
    });

  } catch (error) {
    console.error("Create availability failed:", error.message);
    return res.status(500).json({ error: "Internal availability service fault." });
  } finally {
    if (client) client.release();
  }
};

export const listAvailabilities = async (req, res) => {
  const { tenant_id } = req.user;
  const { staff_id, is_booked, from, to } = req.query;

  let client;
  try {
    client = await pool.connect();

    let query = `
      SELECT id, tenant_id, staff_id, start_time, end_time, is_booked
      FROM availabilities
      WHERE tenant_id = $1
    `;
    const params = [tenant_id];
    let paramIndex = 2;

    if (staff_id) {
      query += ` AND staff_id = $${paramIndex}`;
      params.push(staff_id);
      paramIndex++;
    }

    if (is_booked !== undefined) {
      query += ` AND is_booked = $${paramIndex}`;
      params.push(is_booked === 'true');
      paramIndex++;
    }

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

    query += ` ORDER BY start_time ASC;`;

    const result = await client.query(query, params);

    return res.status(200).json({
      count: result.rows.length,
      availabilities: result.rows
    });

  } catch (error) {
    console.error("List availabilities failed:", error.message);
    return res.status(500).json({ error: "Internal availability service fault." });
  } finally {
    if (client) client.release();
  }
};

export const getAvailability = async (req, res) => {
  const { id } = req.params;
  const { tenant_id } = req.user;

  let client;
  try {
    client = await pool.connect();

    const query = `
      SELECT id, tenant_id, staff_id, start_time, end_time, is_booked
      FROM availabilities
      WHERE id = $1 AND tenant_id = $2;
    `;
    const result = await client.query(query, [id, tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Availability slot not found." });
    }

    return res.status(200).json({ availability: result.rows[0] });

  } catch (error) {
    console.error("Get availability failed:", error.message);
    return res.status(500).json({ error: "Internal availability service fault." });
  } finally {
    if (client) client.release();
  }
};

export const updateAvailability = async (req, res) => {
  const { id } = req.params;
  const { tenant_id, role } = req.user;
  const { staff_id, start_time, end_time } = req.body;

  let client;
  try {
    client = await pool.connect();

    const existingQuery = `
      SELECT id, tenant_id, staff_id, start_time, end_time, is_booked
      FROM availabilities
      WHERE id = $1 AND tenant_id = $2;
    `;
    const existingResult = await client.query(existingQuery, [id, tenant_id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Availability slot not found." });
    }

    const existing = existingResult.rows[0];

    if (existing.is_booked && role !== 'superadmin') {
      return res.status(409).json({ error: "Cannot modify a booked availability slot." });
    }

    const updatedStaffId = staff_id || existing.staff_id;
    const updatedStartTime = start_time || existing.start_time;
    const updatedEndTime = end_time || existing.end_time;

    if (new Date(updatedEndTime) <= new Date(updatedStartTime)) {
      return res.status(400).json({ error: "end_time must be after start_time." });
    }

    const overlapQuery = `
      SELECT id FROM availabilities
      WHERE tenant_id = $1
        AND staff_id = $2
        AND id != $3
        AND is_booked = false
        AND start_time < $5
        AND end_time > $4;
    `;
    const overlapResult = await client.query(overlapQuery, [
      tenant_id, updatedStaffId, id, updatedStartTime, updatedEndTime
    ]);

    if (overlapResult.rows.length > 0) {
      return res.status(409).json({ error: "Conflict: Updated slot overlaps with an existing unbooked availability." });
    }

    const updateQuery = `
      UPDATE availabilities
      SET staff_id = $1, start_time = $2, end_time = $3
      WHERE id = $4 AND tenant_id = $5
      RETURNING id, tenant_id, staff_id, start_time, end_time, is_booked;
    `;
    const result = await client.query(updateQuery, [
      updatedStaffId, updatedStartTime, updatedEndTime, id, tenant_id
    ]);

    return res.status(200).json({
      message: "Availability slot updated successfully.",
      availability: result.rows[0]
    });

  } catch (error) {
    console.error("Update availability failed:", error.message);
    return res.status(500).json({ error: "Internal availability service fault." });
  } finally {
    if (client) client.release();
  }
};

export const deleteAvailability = async (req, res) => {
  const { id } = req.params;
  const { tenant_id, role } = req.user;

  let client;
  try {
    client = await pool.connect();

    const existingQuery = `
      SELECT id, is_booked FROM availabilities
      WHERE id = $1 AND tenant_id = $2;
    `;
    const existingResult = await client.query(existingQuery, [id, tenant_id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Availability slot not found." });
    }

    if (existingResult.rows[0].is_booked && role !== 'superadmin') {
      return res.status(409).json({ error: "Cannot delete a booked availability slot." });
    }

    const deleteQuery = `
      DELETE FROM availabilities
      WHERE id = $1 AND tenant_id = $2
      RETURNING id;
    `;
    await client.query(deleteQuery, [id, tenant_id]);

    return res.status(200).json({ message: "Availability slot deleted successfully." });

  } catch (error) {
    console.error("Delete availability failed:", error.message);
    return res.status(500).json({ error: "Internal availability service fault." });
  } finally {
    if (client) client.release();
  }
};
