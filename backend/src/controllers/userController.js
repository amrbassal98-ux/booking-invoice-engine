import pool from '../config/db.js';

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
