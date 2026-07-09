import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const registerTenantAdmin = async (req, res) => {
  const { tenantName, tenantSlug, email, password, firstName, lastName } = req.body;

  if (!tenantName || !tenantSlug || !email || !password) {
    return res.status(400).json({ error: "Missing required onboarding parameters: tenantName, tenantSlug, email, password." });
  }

  if (!process.env.JWT_SECRET) {
    console.error("CRITICAL: JWT_SECRET is not configured in the environment.");
    return res.status(500).json({ error: "Internal authentication configuration error." });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tenantQuery = `
      INSERT INTO tenants (name, slug)
      VALUES ($1, $2)
      RETURNING id, name, slug, created_at;
    `;
    const tenantResult = await client.query(tenantQuery, [tenantName, tenantSlug]);
    const newTenant = tenantResult.rows[0];

    const passwordHash = await bcrypt.hash(password, 12);

    const userQuery = `
      INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name)
      VALUES ($1, $2, $3, 'tenant_admin', $4, $5)
      RETURNING id, tenant_id, email, role, first_name, last_name, created_at;
    `;
    const userResult = await client.query(userQuery, [
      newTenant.id,
      email,
      passwordHash,
      firstName || null,
      lastName || null
    ]);
    const newAdmin = userResult.rows[0];

    await client.query('COMMIT');

    const tokenPayload = {
      user_id: newAdmin.id,
      tenant_id: newTenant.id,
      role: newAdmin.role
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    return res.status(201).json({
      message: "Tenant registration completed successfully.",
      token,
      tenant: newTenant,
      user: newAdmin
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Onboarding transaction aborted:", error.message);

    if (error.code === '23505') {
      return res.status(409).json({ error: "Conflict: Tenant slug or user email already exists." });
    }

    return res.status(500).json({ error: "Internal transactional engine fault." });
  } finally {
    client.release();
  }
};
