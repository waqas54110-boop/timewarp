const db = require('../config/database');

exports.get = async (userId) => (await db.query('SELECT * FROM saves WHERE user_id = $1', [userId])).rows[0] || null;

// Partial upsert: a part that is not in `d` keeps its old value (COALESCE).
exports.upsert = async (userId, d) => {
  const has = (k) => d[k] !== undefined;
  const { rows } = await db.query(
    `INSERT INTO saves (user_id, last_mode, era, year, destination_id, position, money, mission_progress, life, meta, saved_at)
     VALUES ($1, COALESCE($2::text, 'life'), COALESCE($3::text, 'present'), $4, $5, $6, COALESCE($7, 0), COALESCE($8, 0), $9, $12, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       last_mode = CASE WHEN $2::text IS NULL THEN saves.last_mode ELSE EXCLUDED.last_mode END,
       era = CASE WHEN $3::text IS NULL THEN saves.era ELSE EXCLUDED.era END,
       year = CASE WHEN $10 THEN EXCLUDED.year ELSE saves.year END,
       destination_id = CASE WHEN $10 THEN EXCLUDED.destination_id ELSE saves.destination_id END,
       position = CASE WHEN $10 THEN EXCLUDED.position ELSE saves.position END,
       money = CASE WHEN $10 THEN EXCLUDED.money ELSE saves.money END,
       mission_progress = CASE WHEN $10 THEN EXCLUDED.mission_progress ELSE saves.mission_progress END,
       life = CASE WHEN $11 THEN EXCLUDED.life ELSE saves.life END,
       meta = CASE WHEN $13 THEN EXCLUDED.meta ELSE saves.meta END,
       saved_at = NOW()
     RETURNING *`,
    [userId, d.lastMode || null, d.era || null, has('year') ? d.year : null, d.destinationId || null, has('position') ? JSON.stringify(d.position) : null,
      has('money') ? d.money : null, has('mission') ? d.mission : null, has('life') ? JSON.stringify(d.life) : null, has('position'), has('life'),
      has('meta') ? JSON.stringify(d.meta) : null, has('meta')]);
  return rows[0];
};

// part = 'life' (New Life: only the life is dropped), 'world', or undefined (everything)
exports.clear = async (userId, part) => {
  if (part === 'life') await db.query("UPDATE saves SET life = NULL, last_mode = CASE WHEN year IS NULL THEN last_mode ELSE 'world' END, saved_at = NOW() WHERE user_id = $1", [userId]);
  else if (part === 'world') await db.query("UPDATE saves SET year = NULL, destination_id = NULL, position = NULL, money = 0, mission_progress = 0, last_mode = 'life', saved_at = NOW() WHERE user_id = $1", [userId]);
  else await db.query('DELETE FROM saves WHERE user_id = $1', [userId]);
};
