/**
 * @fileoverview Authentication controller — handles user login and JWT issuance.
 *
 * Validates credentials against the `users` table, resolves the caller's
 * tenant memberships, and returns a signed JWT plus workspace metadata.
 *
 * @module controllers/authController
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

/**
 * POST /api/auth/login
 *
 * Authenticates a user by email/password, resolves their tenant workspaces,
 * and returns a JWT scoped to the primary workspace.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @response {object} 200 - { message, token, user, workspaces }
 * @response {object} 400 - Missing email or password
 * @response {object} 401 - Invalid credentials
 * @response {object} 403 - No tenant workspace assigned
 * @response {object} 500 - Internal server error
 */
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  if (!process.env.JWT_SECRET) {
    console.error("CRITICAL: JWT_SECRET is not configured in the environment.");
    return res.status(500).json({ error: "Internal authentication configuration error." });
  }

  let client;
  try {
    client = await pool.connect();

    /** Look up user by email — constant-time comparison is handled by bcrypt. */
    const userResult = await client.query(
      'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = userResult.rows[0];

    /** Verify password against bcrypt hash. */
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    /** Fetch all tenant memberships for this user. */
    const tenantResult = await client.query(
      `SELECT tu.tenant_id, t.slug, t.name, tu.role
       FROM tenant_users tu
       JOIN tenants t ON tu.tenant_id = t.id
       WHERE tu.user_id = $1
       ORDER BY t.name ASC`,
      [user.id]
    );

    const workspaces = tenantResult.rows;

    if (workspaces.length === 0) {
      return res.status(403).json({ error: "Access denied. No tenant workspace assigned." });
    }

    /** Primary workspace — first alphabetically by tenant name. */
    const primary = workspaces[0];

    /** Sign JWT with 24-hour expiry, scoped to the primary workspace. */
    const tokenPayload = {
      user_id: user.id,
      tenant_id: primary.tenant_id,
      role: primary.role
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    return res.status(200).json({
      message: "Authentication successful.",
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: primary.role
      },
      workspaces
    });

  } catch (error) {
    console.error("Login query failed:", error.message);
    return res.status(500).json({ error: "Internal authentication service fault." });
  } finally {
    if (client) {
      client.release();
    }
  }
};
