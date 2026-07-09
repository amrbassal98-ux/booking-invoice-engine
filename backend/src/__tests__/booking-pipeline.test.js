import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;

const BASE_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const T1 = `test-t-${Date.now()}-a`;
const T2 = `test-t-${Date.now()}-b`;
const EMAIL1 = `customer-a-${Date.now()}@test.com`;
const EMAIL2 = `customer-b-${Date.now()}@test.com`;
const PROVIDER_EMAIL = `provider-${Date.now()}@test.com`;

let t1Id, t2Id, userId, otherUserId, providerId;
let customerToken, otherTenantToken;

const insert = (sql, params) => pool.query(sql, params);
const del = (sql, params) => pool.query(sql, params);

const signToken = (userId, tenantId, role) =>
  jwt.sign({ user_id: userId, tenant_id: tenantId, role }, JWT_SECRET, { expiresIn: '1h' });

beforeAll(async () => {
  const t1 = await insert(`INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`, ['Tenant A', T1]);
  t1Id = t1.rows[0].id;

  const t2 = await insert(`INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`, ['Tenant B', T2]);
  t2Id = t2.rows[0].id;

  const pw = '$2a$12$LQv3c1yqBo9SkvXS7QTnQeMcBrJnZqsVQw3jDsCmYqfhR3dBHmOi';

  const u1 = await insert(
    `INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id`,
    [EMAIL1, pw, 'Test', 'Customer A']
  );
  userId = u1.rows[0].id;

  const u2 = await insert(
    `INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id`,
    [EMAIL2, pw, 'Test', 'Customer B']
  );
  otherUserId = u2.rows[0].id;

  const prov = await insert(
    `INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id`,
    [PROVIDER_EMAIL, pw, 'Test', 'Provider']
  );
  providerId = prov.rows[0].id;

  await insert(`INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, 'customer')`, [t1Id, userId]);
  await insert(`INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, 'customer')`, [t2Id, otherUserId]);
  await insert(`INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, 'provider')`, [t1Id, providerId]);

  customerToken = signToken(userId, t1Id, 'customer');
  otherTenantToken = signToken(otherUserId, t2Id, 'customer');
});

afterAll(async () => {
  const testTenantIds = [t1Id, t2Id];

  const invoiceRows = await pool.query(
    `SELECT i.id FROM invoices i
     JOIN bookings b ON i.booking_id = b.id
     WHERE b.tenant_id = ANY($1)`,
    [testTenantIds]
  );
  if (invoiceRows.rows.length) {
    await del(`DELETE FROM invoices WHERE id = ANY($1)`, [invoiceRows.rows.map((r) => r.id)]);
  }

  await del(`DELETE FROM bookings WHERE tenant_id = ANY($1)`, [testTenantIds]);
  await del(`DELETE FROM availabilities WHERE tenant_id = ANY($1)`, [testTenantIds]);
  await del(`DELETE FROM tenant_users WHERE tenant_id = ANY($1)`, [testTenantIds]);
  await del(`DELETE FROM tenant_invitations WHERE tenant_id = ANY($1)`, [testTenantIds]);
  await del(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [userId, otherUserId, providerId]);
  await del(`DELETE FROM tenants WHERE id IN ($1, $2)`, [t1Id, t2Id]);
  await pool.end();
});

describe('Slot visibility & tenant isolation', () => {
  let availableSlotId, bookedSlotId;

  beforeAll(async () => {
    const s1 = await insert(
      `INSERT INTO availabilities (tenant_id, staff_id, start_time, end_time, is_booked)
       VALUES ($1, $2, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', false)
       RETURNING id`,
      [t1Id, providerId]
    );
    availableSlotId = s1.rows[0].id;

    const s2 = await insert(
      `INSERT INTO availabilities (tenant_id, staff_id, start_time, end_time, is_booked)
       VALUES ($1, $2, NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 2 hours', true)
       RETURNING id`,
      [t1Id, providerId]
    );
    bookedSlotId = s2.rows[0].id;
  });

  it('customer sees only available slots for their own tenant', async () => {
    const res = await request(BASE_URL)
      .get('/api/availabilities')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-tenant-id', t1Id)
      .expect(200);

    expect(res.body.count).toBeGreaterThanOrEqual(1);

    const ids = res.body.availabilities.map((a) => a.id);
    expect(ids).toContain(availableSlotId);
    expect(ids).not.toContain(bookedSlotId);
  });

  it('customer sees zero slots from a different tenant', async () => {
    const res = await request(BASE_URL)
      .get('/api/availabilities')
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .set('x-tenant-id', t2Id)
      .expect(200);

    const ids = res.body.availabilities.map((a) => a.id);
    expect(ids).not.toContain(availableSlotId);
    expect(ids).not.toContain(bookedSlotId);
  });
});

describe('Booking atomic state transitions', () => {
  let freshSlotId, bookingId;

  beforeAll(async () => {
    const s = await insert(
      `INSERT INTO availabilities (tenant_id, staff_id, start_time, end_time, is_booked)
       VALUES ($1, $2, NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days 2 hours', false)
       RETURNING id`,
      [t1Id, providerId]
    );
    freshSlotId = s.rows[0].id;
  });

  it('createBooking transitions slot is_booked to true', async () => {
    const res = await request(BASE_URL)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-tenant-id', t1Id)
      .send({ availability_id: freshSlotId, total_amount: 75.5, currency: 'USD' })
      .expect(201);

    expect(res.body.booking).toBeDefined();
    expect(res.body.booking.availability_id).toBe(freshSlotId);
    expect(Number(res.body.booking.total_amount)).toBeCloseTo(75.5);
    bookingId = res.body.booking.id;

    const slot = await pool.query(`SELECT is_booked FROM availabilities WHERE id = $1`, [freshSlotId]);
    expect(slot.rows[0].is_booked).toBe(true);
  });

  it('getBooking retrieves the created booking within the same tenant', async () => {
    const res = await request(BASE_URL)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-tenant-id', t1Id)
      .expect(200);

    expect(res.body.booking.id).toBe(bookingId);
    expect(res.body.booking.status).toBeDefined();
  });

  afterAll(async () => {
    if (bookingId) {
      await del(`DELETE FROM invoices WHERE booking_id = $1`, [bookingId]);
      await del(`DELETE FROM bookings WHERE id = $1`, [bookingId]);
    }
    if (freshSlotId) {
      await del(`UPDATE availabilities SET is_booked = false WHERE id = $1`, [freshSlotId]);
    }
  });
});

describe('Concurrent double-booking race condition', () => {
  let raceSlotId;

  beforeAll(async () => {
    const s = await insert(
      `INSERT INTO availabilities (tenant_id, staff_id, start_time, end_time, is_booked)
       VALUES ($1, $2, NOW() + INTERVAL '4 days', NOW() + INTERVAL '4 days 2 hours', false)
       RETURNING id`,
      [t1Id, providerId]
    );
    raceSlotId = s.rows[0].id;
  });

  it('rejects second booking when two requests hit the same available slot concurrently', async () => {
    const payload = { availability_id: raceSlotId, total_amount: 100, currency: 'USD' };

    const [r1, r2] = await Promise.all([
      request(BASE_URL)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-tenant-id', t1Id)
        .send(payload),
      request(BASE_URL)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-tenant-id', t1Id)
        .send(payload),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const slot = await pool.query(`SELECT is_booked FROM availabilities WHERE id = $1`, [raceSlotId]);
    expect(slot.rows[0].is_booked).toBe(true);
  });

  afterAll(async () => {
    const bookingRows = await pool.query(`SELECT id FROM bookings WHERE availability_id = $1`, [raceSlotId]);
    if (bookingRows.rows.length) {
      const bookingIds = bookingRows.rows.map((r) => r.id);
      await del(`DELETE FROM invoices WHERE booking_id = ANY($1)`, [bookingIds]);
      await del(`DELETE FROM bookings WHERE id = ANY($1)`, [bookingIds]);
    }
    await del(`DELETE FROM availabilities WHERE id = $1`, [raceSlotId]);
  });
});

describe('Data isolation & side effects', () => {
  let sideEffectSlotId, sideEffectBookingId;

  beforeAll(async () => {
    const s = await insert(
      `INSERT INTO availabilities (tenant_id, staff_id, start_time, end_time, is_booked)
       VALUES ($1, $2, NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days 2 hours', false)
       RETURNING id`,
      [t1Id, providerId]
    );
    sideEffectSlotId = s.rows[0].id;
  });

  it('successful booking creates linked booking and invoice records under the same tenant', async () => {
    const res = await request(BASE_URL)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-tenant-id', t1Id)
      .send({ availability_id: sideEffectSlotId, total_amount: 200, currency: 'USD' })
      .expect(201);

    sideEffectBookingId = res.body.booking.id;

    const bookingRow = await pool.query(
      `SELECT id, tenant_id, customer_id, availability_id, status
       FROM bookings WHERE id = $1`,
      [sideEffectBookingId]
    );
    expect(bookingRow.rows.length).toBe(1);
    expect(bookingRow.rows[0].tenant_id).toBe(t1Id);
    expect(bookingRow.rows[0].customer_id).toBe(userId);
    expect(bookingRow.rows[0].availability_id).toBe(sideEffectSlotId);

    const invoiceRow = await pool.query(
      `SELECT id, tenant_id, booking_id, status, amount_due
       FROM invoices WHERE booking_id = $1`,
      [sideEffectBookingId]
    );
    expect(invoiceRow.rows.length).toBe(1);
    expect(invoiceRow.rows[0].tenant_id).toBe(t1Id);
    expect(invoiceRow.rows[0].amount_due).toBe('200.00');
  });

  it('booking and invoice records are invisible to a different tenant', async () => {
    const bookingRes = await request(BASE_URL)
      .get(`/api/bookings/${sideEffectBookingId}`)
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .set('x-tenant-id', t2Id)
      .expect(404);

    expect(bookingRes.body.error).toMatch(/not found/i);

    const invoiceRow = await pool.query(
      `SELECT id FROM invoices WHERE booking_id = $1 AND tenant_id = $2`,
      [sideEffectBookingId, t2Id]
    );
    expect(invoiceRow.rows.length).toBe(0);
  });

  afterAll(async () => {
    if (sideEffectBookingId) {
      await del(`DELETE FROM invoices WHERE booking_id = $1`, [sideEffectBookingId]);
      await del(`DELETE FROM bookings WHERE id = $1`, [sideEffectBookingId]);
    }
    if (sideEffectSlotId) {
      await del(`DELETE FROM availabilities WHERE id = $1`, [sideEffectSlotId]);
    }
  });
});
