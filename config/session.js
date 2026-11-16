const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const { pool } = require('./database');

const isProd = process.env.NODE_ENV === 'production';

module.exports = session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  name: 'tw.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 1000 * 60 * 60 * 24 * 7 },
});
