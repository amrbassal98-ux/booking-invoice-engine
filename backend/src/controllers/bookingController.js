import pool from '../config/db.js';

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

    const updateSlotQuery = `
      UPDATE availabilities
      SET is_booked = true
      WHERE id = $1 AND tenant_id = $2;
    `;
    await client.query(updateSlotQuery, [availability_id, tenant_id]);

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
