import 'dotenv/config';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 60
});

const CONCURRENCY = 50;
const BATCH_SIZE = 10;
const JWT_SECRET = process.env.JWT_SECRET;

const insert = (sql, params) => pool.query(sql, params);
const query = (sql, params) => pool.query(sql, params);

let tenantId, customerId, slotId;

async function seed() {
  const t = await insert(
    `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
    ['Concurrency Test Tenant', `conc-test-${Date.now()}`]
  );
  tenantId = t.rows[0].id;

  const customer = await insert(
    `INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id`,
    [`conc-customer-${Date.now()}@test.com`, 'hash', 'Conc', 'Customer']
  );
  customerId = customer.rows[0].id;

  await insert(
    `INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, $3)`,
    [tenantId, customerId, 'customer']
  );

  const provider = await insert(
    `INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id`,
    [`conc-provider-${Date.now()}@test.com`, 'hash', 'Conc', 'Provider']
  );

  const slot = await insert(
    `INSERT INTO availabilities (tenant_id, staff_id, start_time, end_time, is_booked)
     VALUES ($1, $2, NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '1 hour', false)
     RETURNING id`,
    [tenantId, provider.rows[0].id]
  );
  slotId = slot.rows[0].id;

  console.log(`  [SEED] tenant=${tenantId}`);
  console.log(`  [SEED] customer=${customerId}`);
  console.log(`  [SEED] slot=${slotId}`);
}

function buildToken() {
  return jwt.sign(
    { user_id: customerId, tenant_id: tenantId, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function fireRequest(token) {
  return request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .set('x-tenant-id', tenantId)
    .send({
      availability_id: slotId,
      total_amount: 99.99,
      currency: 'USD'
    });
}

async function run() {
  console.log(`\n=== Concurrency Stress Test: ${CONCURRENCY} requests in batches of ${BATCH_SIZE} ===\n`);

  const token = buildToken();
  const start = performance.now();

  const allResults = [];
  for (let i = 0; i < CONCURRENCY; i += BATCH_SIZE) {
    const batch = Array.from({ length: Math.min(BATCH_SIZE, CONCURRENCY - i) }, () => fireRequest(token));
    const batchResults = await Promise.all(batch);
    allResults.push(...batchResults);
  }

  const elapsed = (performance.now() - start).toFixed(0);

  const successes = allResults.filter((r) => r.status === 201);
  const conflicts = allResults.filter((r) => r.status === 409);
  const other = allResults.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`  [RESULTS] Completed in ${elapsed}ms`);
  console.log(`  [RESULTS] 201 Created:    ${successes.length}`);
  console.log(`  [RESULTS] 409 Conflict:   ${conflicts.length}`);
  console.log(`  [RESULTS] Other:          ${other.length}`);

  if (other.length > 0) {
    console.log('\n  [UNEXPECTED RESPONSES]');
    other.forEach((r, i) => {
      console.log(`    #${i + 1} status=${r.status} body=${JSON.stringify(r.body)}`);
    });
  }

  console.log('\n--- Assertions ---');

  let passed = 0;
  let failed = 0;

  function assert(condition, msg) {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  assert(successes.length === 1, `Exactly 1 success (got ${successes.length})`);
  assert(conflicts.length === CONCURRENCY - 1, `Exactly ${CONCURRENCY - 1} conflicts (got ${conflicts.length})`);

  if (successes.length > 0) {
    const body = successes[0].body;
    assert(body.booking?.status === 'pending' || body.booking?.status === 'confirmed', `Winning booking status is 'pending' or 'confirmed' (got '${body.booking?.status}')`);
    assert(body.booking?.total_amount === 99.99 || body.booking?.total_amount === '99.99', `Winning booking amount is 99.99`);
    assert(body.invoice != null, `Winning booking has linked invoice`);
  }

  const dbCheck = await query(
    `SELECT COUNT(*) AS cnt FROM bookings WHERE tenant_id = $1 AND availability_id = $2`,
    [tenantId, slotId]
  );
  const bookingCount = parseInt(dbCheck.rows[0].cnt, 10);
  assert(bookingCount === 1, `Exactly 1 booking row in DB for slot (got ${bookingCount})`);

  const slotCheck = await query(
    `SELECT is_booked FROM availabilities WHERE id = $1`,
    [slotId]
  );
  assert(slotCheck.rows[0].is_booked === true, `Slot is_booked is true after concurrent booking`);

  const invoiceCheck = await query(
    `SELECT COUNT(*) AS cnt FROM invoices WHERE tenant_id = $1 AND booking_id = (SELECT id FROM bookings WHERE availability_id = $2 LIMIT 1)`,
    [tenantId, slotId]
  );
  const invoiceCount = parseInt(invoiceCheck.rows[0].cnt, 10);
  assert(invoiceCount === 1, `Exactly 1 invoice row linked to the winning booking (got ${invoiceCount})`);

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);

  if (failed > 0) {
    console.error('\n=== STRESS TEST FAILED ===');
    process.exitCode = 1;
  } else {
    console.log('\n=== STRESS TEST PASSED ===');
  }
}

async function cleanup() {
  if (slotId) await query(`DELETE FROM availabilities WHERE id = $1`, [slotId]).catch(() => {});
  await query(`DELETE FROM invoices WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await query(`DELETE FROM bookings WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await query(`DELETE FROM tenant_users WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await query(`DELETE FROM tenant_invitations WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await query(`DELETE FROM availabilities WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await query(`DELETE FROM users WHERE id = $1`, [customerId]).catch(() => {});
  await query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
  await pool.end();
}

async function main() {
  try {
    await seed();
    await run();
  } catch (err) {
    console.error(`\n=== TEST ERROR ===\n${err.stack}`);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

main();
