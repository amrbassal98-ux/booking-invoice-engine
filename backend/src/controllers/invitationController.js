/**
 * @fileoverview Invitation controller — manages workspace invitation lifecycle.
 *
 * - `createInvitation` generates a token-based invite for a target email/role.
 * - `acceptInvitation` validates the token, creates the user if needed, and
 *   adds them to the tenant workspace.
 *
 * @module controllers/invitationController
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

/**
 * POST /api/invitations
 *
 * Creates a new invitation for the given email and role within the current
 * tenant workspace. Requires `tenant_admin` role.
 *
 * If the user already exists, checks for duplicate membership. If a pending
 * invite already exists for the same email/tenant, it is replaced.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @response {object} 201 - Invitation created with token
 * @response {object} 400 - Missing email or invalid format
 * @response {object} 409 - User already a member
 * @response {object} 500 - Internal server error
 */
export const createInvitation = async (req, res) => {
  const { tenant_id, user_id } = req.user;
  const { email, role } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Missing required field: email." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  /** Only provider, staff, and customer roles are inviteable. */
  const allowedRoles = ['provider', 'staff', 'customer'];
  const targetRole = role && allowedRoles.includes(role) ? role : 'provider';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    /** Check if the invitee already has a user account. */
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      const alreadyMember = await client.query(
        'SELECT user_id FROM tenant_users WHERE tenant_id = $1 AND user_id = $2',
        [tenant_id, existingUser.rows[0].id]
      );

      if (alreadyMember.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: "User is already a member of this workspace." });
      }
    }

    /** Remove any previous pending invite for this email/tenant pair. */
    const pendingInvite = await client.query(
      'SELECT id FROM tenant_invitations WHERE tenant_id = $1 AND email = $2 AND accepted_at IS NULL',
      [tenant_id, email]
    );

    if (pendingInvite.rows.length > 0) {
      await client.query(
        'DELETE FROM tenant_invitations WHERE id = $1',
        [pendingInvite.rows[0].id]
      );
    }

    /** Generate a cryptographically random 64-char hex token. */
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await client.query(
      `INSERT INTO tenant_invitations (tenant_id, invited_by, email, role, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tenant_id, email, role, token, expires_at, created_at`,
      [tenant_id, user_id, email, targetRole, token, expiresAt]
    );

    await client.query('COMMIT');

    const invitation = result.rows[0];

    return res.status(201).json({
      message: "Invitation created successfully.",
      invitation
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Create invitation transaction aborted:", error.message);
    return res.status(500).json({ error: "Internal invitation service fault." });
  } finally {
    client.release();
  }
};

/**
 * POST /api/invitations/accept
 *
 * Accepts a pending invitation by token. If the invitee already has an account,
 * they are added to the workspace. If not, a new account is created (password
 * required). Returns a JWT for new account registrations.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @response {object} 200 - Invitation accepted, user added to workspace
 * @response {object} 400 - Missing token or password
 * @response {object} 404 - Invalid invitation token
 * @response {object} 409 - Invitation already accepted
 * @response {object} 410 - Invitation expired
 * @response {object} 500 - Internal server error
 */
export const acceptInvitation = async (req, res) => {
  const { token, password, firstName, lastName } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Missing required field: token." });
  }

  if (!process.env.JWT_SECRET) {
    console.error("CRITICAL: JWT_SECRET is not configured in the environment.");
    return res.status(500).json({ error: "Internal authentication configuration error." });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const inviteResult = await client.query(
      `SELECT id, tenant_id, email, role, expires_at, accepted_at
       FROM tenant_invitations
       WHERE token = $1
       FOR UPDATE`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Invalid or expired invitation." });
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

    /** Check if the invitee already has a user account. */
    let userResult = await client.query(
      'SELECT id, email, first_name, last_name FROM users WHERE email = $1',
      [invitation.email]
    );

    let userId;

    if (userResult.rows.length === 0) {
      /** New user — password is required to create the account. */
      if (!password) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Password is required to create an account. Please provide a password." });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const newUserResult = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, first_name, last_name`,
        [invitation.email, passwordHash, firstName || null, lastName || null, invitation.role]
      );
      userId = newUserResult.rows[0].id;
      userResult = newUserResult;
    } else {
      userId = userResult.rows[0].id;
    }

    /** Add user to tenant workspace (idempotent — skips if already a member). */
    const existingMembership = await client.query(
      'SELECT user_id FROM tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [invitation.tenant_id, userId]
    );

    if (existingMembership.rows.length === 0) {
      await client.query(
        'INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, $3)',
        [invitation.tenant_id, userId, invitation.role]
      );
    }

    /** Mark invitation as accepted. */
    await client.query(
      'UPDATE tenant_invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [invitation.id]
    );

    await client.query('COMMIT');

    const user = userResult.rows[0];

    const response = {
      message: "Invitation accepted successfully.",
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: invitation.role
      },
      tenant_id: invitation.tenant_id
    };

    /** For new account registrations, issue a JWT and return workspace metadata. */
    if (password) {
      const tenantResult = await client.query(
        'SELECT id, name, slug FROM tenants WHERE id = $1',
        [invitation.tenant_id]
      );
      const tenant = tenantResult.rows[0];

      const tokenPayload = {
        user_id: user.id,
        tenant_id: invitation.tenant_id,
        role: invitation.role
      };
      const jwtToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

      response.token = jwtToken;
      response.workspaces = [{
        tenant_id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        role: invitation.role
      }];
    }

    return res.status(200).json(response);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Accept invitation transaction aborted:", error.message);
    return res.status(500).json({ error: "Internal invitation service fault." });
  } finally {
    client.release();
  }
};
