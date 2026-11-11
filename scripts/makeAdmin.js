// Usage: npm run make-admin -- user@example.com [admin|editor]
require('dotenv').config();
const { pool } = require('../config/database');

(async () => {
  const [email, role = 'admin'] = process.argv.slice(2);
  if (!email || !['admin', 'editor', 'user'].includes(role)) {
    console.log('Usage: npm run make-admin -- user@example.com [admin|editor|user]');
    return pool.end();
  }
  const r = await pool.query('UPDATE users SET role = $1 WHERE email = $2 RETURNING id', [role, email.toLowerCase()]);
  console.log(r.rowCount ? `${email} is now ${role}.` : 'No user with that email. Register first.');
  await pool.end();
})();
