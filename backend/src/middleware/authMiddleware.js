import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  if (!process.env.JWT_SECRET) {
    console.error("CRITICAL: JWT_SECRET is not configured in the environment.");
    return res.status(500).json({ error: "Internal authentication configuration error." });
  }

  let client;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const requestedTenantId = req.headers['x-tenant-id']
      || decoded.tenant_id;

    if (!requestedTenantId || Number.isNaN(requestedTenantId)) {
      return res.status(400).json({ error: "Access denied. Invalid tenant context." });
    }

    client = await pool.connect();

    const result = await client.query(
      'SELECT role FROM tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [requestedTenantId, decoded.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Access denied. Not a member of this tenant workspace." });
    }

    const confirmedRole = result.rows[0].role;

    req.user = {
      user_id: decoded.user_id,
      tenant_id: requestedTenantId,
      role: confirmedRole
    };
    req.tenant_id = requestedTenantId;
    req.user_role = confirmedRole;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Access denied. Token has expired." });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: "Access denied. Invalid token." });
    }
    console.error('[AUTH] Middleware error:', error.code || error.name, error.message);
    return res.status(500).json({ error: "Internal authentication service error." });
  } finally {
    if (client) {
      client.release();
    }
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: "Access denied. No user role found." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Access denied. Insufficient permissions for this resource." 
      });
    }

    next();
  };
};
