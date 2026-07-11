/**
 * @fileoverview Tenant onboarding controller.
 *
 * Handles two registration flows:
 *   1. **Direct registration** — creates a new tenant, user, and tenant_admin membership.
 *   2. **Invitation-based registration** — accepts an invitation token, creates the
 *      user account (if new), and adds them to the existing tenant workspace.
 *
 * Both flows run inside a single database transaction to guarantee atomicity.
 *
 * @module controllers/tenantController
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

/**
 * POST /api/tenants/onboard
 *
 * Onboards a new tenant admin or accepts an invitation token.
 *
 * When `inviteToken` is absent, creates a brand-new tenant + admin user.
 * When `inviteToken` is present, validates the invitation, creates the user
 * account if they don't exist, adds them to the workspace, and issues a JWT.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @response {object} 201 - Registration success with token + user + workspaces
 * @response {object} 400 - Missing required fields
 * @response {object} 403 - Invitation email mismatch
 * @response {object} 404 - Invalid invitation token
 * @response {object} 409 - Invitation already accepted / duplicate slug or email
 * @response {object} 410 - Invitation expired
 * @response {object} 500 - Internal server error
 */
export const registerTenantAdmin = async (req, res) => {
  const { tenantName, tenantSlug, email, password, firstName, lastName, inviteToken } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing required fields: email, password." });
  }

  if (typeof email !== 'string') {
    return res.status(400).json({ error: "email must be a string." });
  }

  if (!inviteToken && (!tenantName || !tenantSlug)) {
    return res.status(400).json({ error: "Missing required onboarding parameters: tenantName, tenantSlug (or provide inviteToken)." });
  }

  if (!process.env.JWT_SECRET) {
    console.error("CRITICAL: JWT_SECRET is not configured in the environment.");
    return res.status(500).json({ error: "Internal authentication configuration error." });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let workspace;

    if (inviteToken) {
      /** Invitation flow — validate token, create user, join workspace. */
      const inviteResult = await client.query(
        `SELECT id, tenant_id, email, role, expires_at, accepted_at
         FROM tenant_invitations
         WHERE token = $1
         FOR UPDATE`,
        [inviteToken]
      );

      if (inviteResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Invalid invitation token." });
      }

      const invitation = inviteResult.rows[0];

      if (invitation.accepted_at) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: "Invitation has already been accepted." });
      }

      if (new Date(invitation.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return res.status(410).json({ error: "Invitation has expired." });
      }

      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: "Invitation email does not match registration email." });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const userResult = await client.query(
        'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, created_at',
        [email, passwordHash, firstName || null, lastName || null]
      );
      const newUser = userResult.rows[0];

      await client.query(
        'INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, $3)',
        [invitation.tenant_id, newUser.id, invitation.role]
      );

      /** Consume the invitation — mark as accepted and delete. */
      await client.query(
        'DELETE FROM tenant_invitations WHERE id = $1',
        [invitation.id]
      );

      const tenantResult = await client.query(
        'SELECT id, name, slug FROM tenants WHERE id = $1',
        [invitation.tenant_id]
      );
      const tenant = tenantResult.rows[0];

      workspace = {
        tenant_id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        role: invitation.role
      };

      await client.query('COMMIT');

      const tokenPayload = {
        user_id: newUser.id,
        tenant_id: tenant.id,
        role: invitation.role
      };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

      return res.status(201).json({
        message: "Registration completed. You have joined the workspace.",
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: invitation.role
        },
        workspaces: [workspace]
      });

    } else {
      /** Direct registration flow — create tenant + admin user. */
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
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Onboarding transaction aborted:", error.message);

    /** Handle unique constraint violations on tenant slug or user email. */
    if (error.code === '23505') {
      return res.status(409).json({ error: "Conflict: Tenant slug or user email already exists." });
    }

    return res.status(500).json({ error: "Internal transactional engine fault." });
  } finally {
    client.release();
  }
};
