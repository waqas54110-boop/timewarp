const db = require('../config/database');

async function list({ category, targetYear } = {}) {
  const where = [];
  const params = [];
  if (category) { params.push(category); where.push(`category ILIKE $${params.length}`); }
  if (targetYear != null) { params.push(targetYear); where.push(`target_year <= $${params.length}`); }
  const sql = `SELECT * FROM predictions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY target_year, id LIMIT 100`;
  return (await db.query(sql, params)).rows;
}

async function nearestToYear(year, limit = 6) {
  return (
    await db.query('SELECT * FROM predictions ORDER BY ABS(target_year - $1), id LIMIT $2', [year, limit])
  ).rows;
}

async function categories() {
  return (await db.query('SELECT DISTINCT category FROM predictions WHERE category IS NOT NULL ORDER BY 1')).rows.map((r) => r.category);
}

module.exports = { list, nearestToYear, categories };
