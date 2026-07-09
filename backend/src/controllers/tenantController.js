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

    const tenantResult = await client.query(
      'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at',
      [tenantName, tenantSlug]
    );
    const newTenant = tenantResult.rows[0];

    const passwordHash = await bcrypt.hash(password, 12);

    const userResult = await client.query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, created_at',
      [email, passwordHash, firstName || null, lastName || null]
    );
    const newUser = userResult.rows[0];

    await client.query(
      'INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, $3)',
      [newTenant.id, newUser.id, 'tenant_admin']
    );

    await client.query('COMMIT');

    const tokenPayload = {
      user_id: newUser.id,
      tenant_id: newTenant.id,
      role: 'tenant_admin'
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    return res.status(201).json({
      message: "Tenant registration completed successfully.",
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: 'tenant_admin'
      },
      workspaces: [{
        tenant_id: newTenant.id,
        slug: newTenant.slug,
        name: newTenant.name,
        role: 'tenant_admin'
      }]
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
