const db = require('../config/database');

async function create({ userId, destinationId, selectedYear, travelType }) {
  const r = await db.query(
    `INSERT INTO journeys (user_id, destination_id, selected_year, travel_type)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, destinationId ?? null, selectedYear, travelType]
  );
  return r.rows[0];
}

async function listForUser(userId) {
  return (
    await db.query(
      `SELECT j.*, d.name AS destination_name, d.country FROM journeys j
       LEFT JOIN destinations d ON d.id = j.destination_id
       WHERE j.user_id = $1 ORDER BY j.created_at DESC`,
      [userId]
    )
  ).rows;
}

// Ownership is enforced in SQL: a user can only delete their own rows.
async function deleteOwned(id, userId) {
  return (await db.query('DELETE FROM journeys WHERE id = $1 AND user_id = $2', [id, userId])).rowCount > 0;
}

module.exports = { create, listForUser, deleteOwned };
