import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

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

    const userResult = await client.query(
      'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = userResult.rows[0];

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

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

    const primary = workspaces[0];

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
