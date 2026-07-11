import 'dotenv/config';
import pg from 'pg';
import request from 'supertest';
import app from '../app.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const insert = (sql, params) => pool.query(sql, params);
const query = (sql, params) => pool.query(sql, params);

let tenantId, providerId, customerId, slotId;

async function seed() {
  const t = await insert(
    `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
    ['Webhook Test Tenant', `wh-test-${Date.now()}`]
  );
  tenantId = t.rows[0].id;

  const provider = await insert(
    `INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id`,
    [`provider-wh-${Date.now()}@test.com`, 'hash', 'Provider', 'Test']
  );
  providerId = provider.rows[0].id;

  const customer = await insert(
    `INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id`,
    [`customer-wh-${Date.now()}@test.com`, 'hash', 'Customer', 'Test']
  );
  customerId = customer.rows[0].id;

  await insert(
    `INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, $3)`,
    [tenantId, providerId, 'provider']
  );
  await insert(
    `INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, $3)`,
    [tenantId, customerId, 'customer']
  );

  const slot = await insert(
    `INSERT INTO availabilities (tenant_id, staff_id, start_time, end_time, is_booked)
     VALUES ($1, $2, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '1 hour', false)
     RETURNING id`,
    [tenantId, providerId]
  );
  slotId = slot.rows[0].id;

  console.log(`  [SEED] tenant=${tenantId}`);
  console.log(`  [SEED] provider=${providerId}`);
  console.log(`  [SEED] customer=${customerId}`);
  console.log(`  [SEED] slot=${slotId}`);
}

function buildMockEvent(type = 'payment_intent.succeeded') {
  return {
    id: `evt_mock_${Date.now()}`,
    type,
    data: {
      object: {
        id: `pi_mock_${Date.now()}`,
        amount: 5500,
        currency: 'usd',
        status: 'succeeded',
        metadata: {
          tenant_id: tenantId,
          slot_id: slotId,
          customer_id: customerId,
          total_amount: '55.00',
          currency: 'USD'
        }
      }
    }
  };
}

async function assertSlotBooked() {
  const res = await query(`SELECT is_booked FROM availabilities WHERE id = $1`, [slotId]);
  const slot = res.rows[0];
  if (!slot) throw new Error(`FAIL: Slot ${slotId} not found`);
  if (!slot.is_booked) throw new Error(`FAIL: Slot ${slotId} is_booked is still false`);
  console.log(`  [PASS] Slot ${slotId} is_booked = true`);
}

async function assertBookingCreated() {
  const res = await query(
    `SELECT id, tenant_id, customer_id, availability_id, status, total_amount, currency
     FROM bookings WHERE tenant_id = $1 AND customer_id = $2 AND availability_id = $3`,
    [tenantId, customerId, slotId]
  );
  if (res.rows.length === 0) throw new Error('FAIL: No booking record found');
  const b = res.rows[0];
  if (b.status !== 'confirmed') throw new Error(`FAIL: Booking status is '${b.status}', expected 'confirmed'`);
  if (Number(b.total_amount) !== 55) throw new Error(`FAIL: Booking total_amount is ${b.total_amount}, expected 55`);
  if (b.currency !== 'USD') throw new Error(`FAIL: Booking currency is '${b.currency}', expected 'USD'`);
  console.log(`  [PASS] Booking ${b.id} created (status=confirmed, amount=${b.total_amount} ${b.currency})`);
  return b.id;
}

async function assertInvoiceCreated(bookingId) {
  const res = await query(
    `SELECT id, tenant_id, booking_id, status, amount_due, amount_paid
     FROM invoices WHERE booking_id = $1 AND tenant_id = $2`,
    [bookingId, tenantId]
  );
  if (res.rows.length === 0) throw new Error('FAIL: No invoice record found');
  const inv = res.rows[0];
  if (inv.status !== 'unpaid') throw new Error(`FAIL: Invoice status is '${inv.status}', expected 'unpaid'`);
  if (Number(inv.amount_due) !== 55) throw new Error(`FAIL: Invoice amount_due is ${inv.amount_due}, expected 55`);
  if (Number(inv.amount_paid) !== 0) throw new Error(`FAIL: Invoice amount_paid is ${inv.amount_paid}, expected 0`);
  console.log(`  [PASS] Invoice ${inv.id} created (status=${inv.status}, due=${inv.amount_due}, paid=${inv.amount_paid})`);
}

async function cleanup() {
  if (slotId) await query(`DELETE FROM availabilities WHERE id = $1`, [slotId]).catch(() => {});
  await query(`DELETE FROM invoices WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await query(`DELETE FROM bookings WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await query(`DELETE FROM tenant_users WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await query(`DELETE FROM tenant_invitations WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await query(`DELETE FROM availabilities WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await query(`DELETE FROM users WHERE id IN ($1, $2)`, [providerId, customerId]).catch(() => {});
  await query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
  await pool.end();
}

async function runTest(eventType) {
  const label = eventType || 'payment_intent.succeeded';
  console.log(`\n--- Test: ${label} ---`);

  const event = buildMockEvent(label);
  const payload = JSON.stringify(event);

  const res = await request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .send(payload);

  console.log(`  [HTTP] Status: ${res.status}`);
  console.log(`  [HTTP] Body: ${JSON.stringify(res.body, null, 2)}`);

  if (res.status !== 200) {
    throw new Error(`FAIL: Expected 200, got ${res.status}`);
  }
  if (!res.body.received) {
    throw new Error('FAIL: Response missing received: true');
  }

  await assertSlotBooked();
  const bookingId = await assertBookingCreated();
  await assertInvoiceCreated(bookingId);
  console.log(`--- PASS: ${label} ---\n`);
}

async function testAlreadyBooked() {
  console.log('\n--- Test: idempotency (already booked) ---');
  const event = buildMockEvent('payment_intent.succeeded');
  const payload = JSON.stringify(event);

  const res = await request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .send(payload);

  console.log(`  [HTTP] Status: ${res.status}`);
  if (res.status !== 409) {
    throw new Error(`FAIL: Expected 409 for already-booked slot, got ${res.status}`);
  }
  console.log('  [PASS] Correctly returned 409 Conflict');
  console.log('--- PASS: idempotency ---\n');
}

async function testCheckoutSessionCompleted() {
  console.log('\n--- Test: checkout.session.completed ---');

  const slot2 = await insert(
    `INSERT INTO availabilities (tenant_id, staff_id, start_time, end_time, is_booked)
     VALUES ($1, $2, NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '1 hour', false)
     RETURNING id`,
    [tenantId, providerId]
  );
  const slot2Id = slot2.rows[0].id;
  console.log(`  [SEED] second slot=${slot2Id}`);

  const event = {
    id: `evt_mock_session_${Date.now()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_mock_${Date.now()}`,
        payment_status: 'paid',
        metadata: {
          tenant_id: tenantId,
          slot_id: slot2Id,
          customer_id: customerId,
          total_amount: '75.50',
          currency: 'USD'
        }
      }
    }
  };

  const res = await request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(event));

  console.log(`  [HTTP] Status: ${res.status}`);
  if (res.status !== 200) throw new Error(`FAIL: Expected 200, got ${res.status}`);

  const slotCheck = await query(`SELECT is_booked FROM availabilities WHERE id = $1`, [slot2Id]);
  if (!slotCheck.rows[0].is_booked) throw new Error('FAIL: Second slot not booked');
  console.log(`  [PASS] Slot ${slot2Id} is_booked = true`);

  const bookingCheck = await query(
    `SELECT id, status, total_amount FROM bookings WHERE availability_id = $1`, [slot2Id]
  );
  if (bookingCheck.rows.length === 0) throw new Error('FAIL: No booking for second slot');
  const b2 = bookingCheck.rows[0];
  if (b2.status !== 'confirmed') throw new Error(`FAIL: Second booking status '${b2.status}'`);
  if (Number(b2.total_amount) !== 75.50) throw new Error(`FAIL: Second booking amount ${b2.total_amount}`);
  console.log(`  [PASS] Booking ${b2.id} (status=confirmed, amount=${b2.total_amount})`);

  const invoiceCheck = await query(`SELECT id, status, amount_due FROM invoices WHERE booking_id = $1`, [b2.id]);
  if (invoiceCheck.rows.length === 0) throw new Error('FAIL: No invoice for second booking');
  console.log(`  [PASS] Invoice ${invoiceCheck.rows[0].id} (status=${invoiceCheck.rows[0].status}, due=${invoiceCheck.rows[0].amount_due})`);

  console.log('--- PASS: checkout.session.completed ---\n');
}

async function main() {
  console.log('=== Stripe Webhook Mock Test ===\n');
  console.log('[CONFIG] SKIP_WEBHOOK_SIGNATURE=' + process.env.SKIP_WEBHOOK_SIGNATURE);

  try {
    await seed();
    await runTest('payment_intent.succeeded');
    await testAlreadyBooked();
    await testCheckoutSessionCompleted();

    console.log('\n=== ALL TESTS PASSED ===');
  } catch (err) {
    console.error(`\n=== TEST FAILED ===\n${err.message}`);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

main();
