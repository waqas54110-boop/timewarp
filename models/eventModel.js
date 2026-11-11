const db = require('../config/database');

function buildWhere(f) {
  const where = [];
  const params = [];
  const add = (sql, v) => {
    params.push(v);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (f.from != null) add('e.event_year >= ?', f.from);
  if (f.to != null) add('e.event_year <= ?', f.to);
  if (f.destinationId != null) add('e.destination_id = ?', f.destinationId);
  if (f.country) add('d.country ILIKE ?', f.country);
  if (f.category) add('e.category ILIKE ?', f.category);
  return { clause: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

async function list(filters = {}, { limit = 20, offset = 0, order = 'ASC' } = {}) {
  const { clause, params } = buildWhere(filters);
  const dir = order === 'DESC' ? 'DESC' : 'ASC';
  const base = `FROM events e LEFT JOIN destinations d ON d.id = e.destination_id ${clause}`;
  const total = (await db.query(`SELECT COUNT(*)::int AS n ${base}`, params)).rows[0].n;
  const rows = (
    await db.query(
      `SELECT e.*, d.name AS destination_name, d.country ${base}
       ORDER BY e.event_year ${dir}, e.id ${dir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )
  ).rows;
  return { rows, total };
}

async function findById(id) {
  const r = await db.query(
    `SELECT e.*, d.name AS destination_name, d.country FROM events e
     LEFT JOIN destinations d ON d.id = e.destination_id WHERE e.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function mediaFor(eventId) {
  return (await db.query('SELECT * FROM media WHERE event_id = $1 ORDER BY id', [eventId])).rows;
}

async function categories() {
  return (await db.query('SELECT DISTINCT category FROM events WHERE category IS NOT NULL ORDER BY 1')).rows.map((r) => r.category);
}

async function countries() {
  return (await db.query('SELECT DISTINCT country FROM destinations WHERE country IS NOT NULL ORDER BY 1')).rows.map((r) => r.country);
}

// Events whose destination has coordinates, for the globe (one query, filtered by year on the client).
async function geo() {
  return (
    await db.query(
      `SELECT e.id, e.title, e.event_year, e.category, e.destination_id,
              d.name AS destination_name, d.country, d.latitude, d.longitude
       FROM events e JOIN destinations d ON d.id = e.destination_id
       WHERE d.latitude IS NOT NULL AND d.longitude IS NOT NULL
       ORDER BY e.event_year, e.id LIMIT 2000`
    )
  ).rows;
}

module.exports = { list, findById, mediaFor, categories, countries, geo };
