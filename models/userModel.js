const db = require('../config/database');

async function create({ username, email, passwordHash }) {
  const r = await db.query(
    `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)
     RETURNING id, username, email, role`,
    [username, email, passwordHash]
  );
  return r.rows[0];
}

async function findByEmail(email) {
  return (await db.query('SELECT * FROM users WHERE email = $1', [email])).rows[0] || null;
}

module.exports = { create, findByEmail };
