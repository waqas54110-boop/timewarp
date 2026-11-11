const db = require('../config/database');

// keeps only the best verified life of each user
exports.submit = async (userId, name, e) => (await db.query(
  `INSERT INTO life_scores (user_id, name, score, title, age, era, job, created_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
   ON CONFLICT (user_id) DO UPDATE SET
     name = EXCLUDED.name, score = EXCLUDED.score, title = EXCLUDED.title, age = EXCLUDED.age, era = EXCLUDED.era, job = EXCLUDED.job, created_at = NOW()
   WHERE EXCLUDED.score > life_scores.score
   RETURNING score`, [userId, name, e.score, e.title, e.age, e.era, e.job])).rows[0] || null;

exports.mine = async (userId) => (await db.query('SELECT score FROM life_scores WHERE user_id = $1', [userId])).rows[0] || null;

exports.top = async (limit = 20) => (await db.query(
  'SELECT name, score, title, age, era, job, created_at FROM life_scores ORDER BY score DESC, created_at ASC LIMIT $1', [limit])).rows;
