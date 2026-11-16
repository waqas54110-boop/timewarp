const db = require('../config/database');

async function all() {
  return (
    await db.query(
      `SELECT d.*, er.name AS era_name FROM destinations d
       LEFT JOIN eras er ON er.id = d.era_id ORDER BY d.name`
    )
  ).rows;
}

async function findById(id) {
  const r = await db.query(
    `SELECT d.*, er.name AS era_name FROM destinations d
     LEFT JOIN eras er ON er.id = d.era_id WHERE d.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function exists(id) {
  return (await db.query('SELECT 1 FROM destinations WHERE id = $1', [id])).rowCount > 0;
}

async function eras() {
  return (await db.query('SELECT * FROM eras ORDER BY start_year')).rows;
}

async function eraForYear(year) {
  const r = await db.query(
    'SELECT * FROM eras WHERE start_year <= $1 AND end_year >= $1 ORDER BY start_year DESC LIMIT 1',
    [year]
  );
  return r.rows[0] || null;
}

module.exports = { all, findById, exists, eras, eraForYear };
