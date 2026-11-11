const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => console.error('Unexpected PG pool error:', err.message));

module.exports = { pool, query: (text, params) => pool.query(text, params) };
