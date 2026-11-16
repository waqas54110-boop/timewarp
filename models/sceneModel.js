const db = require('../config/database');

let warned = false;

// Best matching immersive scene for a mode/year (and optionally a destination), or null.
async function pick({ mode, year, destinationId = null }) {
  try {
    const r = await db.query(
      `SELECT * FROM scenes
       WHERE mode = $1 AND $2::int BETWEEN year_from AND year_to
         AND (destination_id IS NULL OR destination_id = $3::bigint)
       ORDER BY (destination_id = $3::bigint) DESC NULLS LAST, (year_to - year_from) ASC, id
       LIMIT 1`,
      [mode, year, destinationId]
    );
    return r.rows[0] || null;
  } catch (e) {
    // Table not created yet (migrate not re-run): the generated scene is used instead of a 500.
    if (e.code === '42P01') {
      if (!warned) { warned = true; console.warn('scenes table missing - run `npm run migrate`'); }
      return null;
    }
    throw e;
  }
}

module.exports = { pick };
