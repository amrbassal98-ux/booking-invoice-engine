import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("CRITICAL: DATABASE_URL variable is missing from the localized backend environment configuration.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('[DB] New client connected to PostgreSQL pool');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected idle client error:', err.message);
});

export default pool;