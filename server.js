require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const sessionMiddleware = require('./config/session');
const csrf = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { formatYear } = require('./utils/helpers');

const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET must be set in production');

const app = express();
if (isProd) app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        mediaSrc: ["'self'", 'https:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
  })
);

// Safe defaults so error pages can render even if session/DB middleware failed earlier.
app.use((req, res, next) => {
  res.locals.csrfToken = '';
  res.locals.user = null;
  res.locals.fy = formatYear;
  res.locals.currentPath = req.path;
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));
// Three.js is served from node_modules (no CDN needed, works with strict CSP).
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build'), { maxAge: isProd ? '7d' : 0 }));
// Three.js add-ons (GLTFLoader etc.): served from node_modules with the bare "three" import rewritten for the browser.
const addonsRoot = path.join(__dirname, 'node_modules/three/examples/jsm');
app.get('/vendor/three-addons/*splat', (req, res, next) => {
  const file = path.resolve(addonsRoot, [].concat(req.params.splat).join('/'));
  if (!file.startsWith(addonsRoot + path.sep) || !file.endsWith('.js')) return next();
  fs.readFile(file, 'utf8', (err, src) => {
    if (err) return next();
    res.type('application/javascript').send(src.replace(/from\s+['"]three['"]/g, "from '/vendor/three/three.module.js'"));
  });
});

app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.json({ limit: '64kb' }));
app.use(sessionMiddleware);
app.use(csrf);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.fy = formatYear;
  res.locals.currentPath = req.path;
  next();
});

app.use('/', require('./routes/web'));
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.use('/admin', require('./routes/admin'));

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => console.log(`TimeWarp running on http://localhost:${port}`));
  try { require('./services/partyHub').attach(server, sessionMiddleware); } catch (e) { console.warn('Time Party disabled (run npm install to add the ws package):', e.message); }
}

module.exports = app;
