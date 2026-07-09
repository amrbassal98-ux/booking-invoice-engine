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

    const userQuery = `
      SELECT id, tenant_id, email, password_hash, role, first_name, last_name
      FROM users
      WHERE email = $1;
    `;
    const result = await client.query(userQuery, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = result.rows[0];

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const tokenPayload = {
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    return res.status(200).json({
      message: "Authentication successful.",
      token,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      }
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
