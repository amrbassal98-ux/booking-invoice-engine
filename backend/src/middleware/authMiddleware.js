/**
 * @fileoverview Authentication and role-based authorization middleware.
 *
 * - `authenticateToken` validates the JWT from the Authorization header,
 *   resolves the tenant context from `x-tenant-id` header or the token payload,
 *   and verifies the caller has an active membership in that tenant.
 *
 * - `authorizeRoles` is a higher-order middleware that gates access to
 *   routes based on the authenticated user's role within the active tenant.
 *
 * @module middleware/authMiddleware
 */

import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

/**
 * Express middleware — JWT authentication + tenant membership verification.
 *
 * Extracts the Bearer token from the Authorization header, verifies it
 * against JWT_SECRET, resolves the tenant context, and confirms the user
 * holds a valid role in that tenant via the `tenant_users` join table.
 *
 * On success, attaches `req.user`, `req.tenant_id`, and `req.user_role`.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
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
    /** @type {{ user_id: number, tenant_id: number, role: string }} */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /** Tenant context — client-sourced header takes precedence over token claim. */
    const requestedTenantId = req.headers['x-tenant-id']
      || decoded.tenant_id;

    if (!requestedTenantId || Number.isNaN(requestedTenantId)) {
      return res.status(400).json({ error: "Access denied. Invalid tenant context." });
    }

    client = await pool.connect();

    /** Verify the user belongs to the requested tenant workspace. */
    const result = await client.query(
      'SELECT role FROM tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [requestedTenantId, decoded.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Access denied. Not a member of this tenant workspace." });
    }

    /** Confirmed role from database — not trusted from the token alone. */
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

/**
 * Higher-order middleware — role-based access control (RBAC).
 *
 * Returns an Express middleware that checks `req.user.role` against the
 * provided list of allowed roles. Must be chained after `authenticateToken`.
 *
 * @param   {...string} allowedRoles - Permitted roles (e.g. 'tenant_admin', 'provider')
 * @returns {import('express').RequestHandler} Express middleware function
 *
 * @example
 * router.post('/', authenticateToken, authorizeRoles('tenant_admin'), createHandler);
 */
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
