require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

(async () => {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('Schema applied.');
    if (process.argv.includes('--seed')) {
      await pool.query(fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8'));
      console.log('Sample data seeded (existing content tables were reset).');
    }
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
