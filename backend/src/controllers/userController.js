/**
 * @fileoverview User directory controller.
 *
 * Provides read-only queries for tenant member listings, used by
 * admin dashboards to populate staff/provider dropdowns.
 *
 * @module controllers/userController
 */

import pool from '../config/db.js';

/**
 * GET /api/users/providers
 *
 * Lists all users with `provider` or `staff` roles in the current tenant.
 * Restricted to `tenant_admin` role.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @response {object} 200 - { count, providers: Array<{ id, email, first_name, last_name, role }> }
 */
export const listProviders = async (req, res) => {
  const { tenant_id } = req.user;

  let client;
  try {
    client = await pool.connect();

    const query = `
      SELECT u.id, u.email, u.first_name, u.last_name, tu.role
      FROM users u
      JOIN tenant_users tu ON u.id = tu.user_id
      WHERE tu.tenant_id = $1 AND tu.role IN ('provider', 'staff')
      ORDER BY u.first_name ASC NULLS LAST, u.email ASC;
    `;
    const result = await client.query(query, [tenant_id]);

    return res.status(200).json({
      count: result.rows.length,
      providers: result.rows
    });

  } catch (error) {
    console.error("List providers failed:", error.message);
    return res.status(500).json({ error: "Internal user service fault." });
  } finally {
    if (client) client.release();
  }
};
