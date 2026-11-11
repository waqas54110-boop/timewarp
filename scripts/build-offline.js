// Builds the OFFLINE web bundle for the Android app into mobile/www.
// Run: node scripts/build-offline.js   (after `npm install`, which brings ejs and three)
// The APK contains everything: no server, no database, no internet needed.
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { formatYear } = require('../utils/helpers');

const root = path.join(__dirname, '..');
const out = path.join(root, 'mobile', 'www');
const YEAR = new Date().getFullYear();

const NAV = '<nav id="nav" aria-label="Main"><a href="/index.html">Home</a><a href="/life.html">Life</a><a href="/me.html">Meri Duniya</a><a href="/world-present.html">Live World</a><a href="/world-2050.html">World 2050</a></nav>';

// server links -> the static files of the app; pages that need the server (login, quiz...) are removed
function transform(html) {
  return html
    .replace(/<nav id="nav"[\s\S]*?<\/nav>/, NAV)
    .replace(/<p><button id="install-app"[\s\S]*?<\/p>/, '')
    .replace(/<p><a href="\/about">[\s\S]*?<\/p>/, '')
    .replace(/href="\/world\?mode=future&(?:amp;)?year=\d+"/g, 'href="/world-2050.html"')
    .replace(/href="\/world\?mode=present&(?:amp;)?year=\d+"/g, 'href="/world-present.html"')
    .replace(/href="\/me"/g, 'href="/me.html"')
    .replace(/href="\/life"/g, 'href="/life.html"')
    .replace(/href="\/"/g, 'href="/index.html"')
    .replace('&larr; Back to scene', '&larr; Home');
}

const render = (file, data) => new Promise((resolve, reject) => ejs.renderFile(file, data, {}, (e, s) => (e ? reject(e) : resolve(s))));

const BASE = { title: '', csrfToken: '', user: null, currentPath: '/', fy: formatYear, destination: null, backHref: '/index.html', modelUrl: null, mode: 'present', year: YEAR };
const PAGES = [
  ['life.ejs', 'life.html', { title: 'Life Mode', currentPath: '/life' }],
  ['me.ejs', 'me.html', { title: 'Meri Duniya', currentPath: '/me' }],
  ['world.ejs', 'world-present.html', { title: 'Live World', currentPath: '/world', mode: 'present', year: YEAR }],
  ['world.ejs', 'world-2050.html', { title: 'Live World 2050', currentPath: '/world', mode: 'future', year: 2050 }],
];

const INDEX = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#070b1a"><title>TimeWarp</title><link rel="stylesheet" href="/css/style.css"></head>
<body><main class="section narrow" style="text-align:center;padding-top:8vh">
<h1>TimeWarp</h1><p class="lead">Offline game. Internet ki zaroorat nahi.</p>
<p><a class="btn primary" href="/life.html">Life Mode</a></p>
<p><a class="btn primary" href="/world-present.html">Live World</a></p>
<p><a class="btn ghost" href="/world-2050.html">Live World 2050</a></p>
<p><a class="btn ghost" href="/me.html">Meri Duniya</a></p>
</main></body></html>
`;

function copyThree() {
  const three = path.join(root, 'node_modules', 'three');
  const dest = path.join(out, 'vendor', 'three');
  fs.mkdirSync(dest, { recursive: true });
  const queue = ['three.module.js'];
  const done = new Set();
  while (queue.length) {                       // three.module.js imports ./three.core.js in new versions
    const f = queue.shift();
    if (done.has(f)) continue;
    done.add(f);
    const src = path.join(three, 'build', f);
    fs.copyFileSync(src, path.join(dest, f));
    for (const m of fs.readFileSync(src, 'utf8').matchAll(/(?:from|import)\s+['"]\.\/([^'"]+)['"]/g)) queue.push(m[1]);
  }
  const addonDir = path.join(out, 'vendor', 'three-addons', 'utils');
  fs.mkdirSync(addonDir, { recursive: true });
  const util = fs.readFileSync(path.join(three, 'examples', 'jsm', 'utils', 'BufferGeometryUtils.js'), 'utf8');
  fs.writeFileSync(path.join(addonDir, 'BufferGeometryUtils.js'), util.replace(/from\s+['"]three['"]/g, "from '/vendor/three/three.module.js'"));
}

async function main() {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const pub = path.join(root, 'public');
  fs.cpSync(pub, out, {                        // css, js, icons, data, media (no service worker: the app itself is offline)
    recursive: true,
    filter: (src) => !['sw.js', 'offline.html'].includes(path.relative(pub, src)),
  });
  copyThree();

  for (const [view, file, data] of PAGES) {
    const html = await render(path.join(root, 'views', 'pages', view), { ...BASE, ...data });
    fs.writeFileSync(path.join(out, file), transform(html));
  }
  fs.writeFileSync(path.join(out, 'index.html'), INDEX);

  const must = ['index.html', 'life.html', 'me.html', 'world-present.html', 'world-2050.html', 'css/style.css', 'js/world.js', 'js/life.js',
    'vendor/three/three.module.js', 'vendor/three-addons/utils/BufferGeometryUtils.js', 'media/world-ids.png', 'media/world-sdf.png', 'data/countries.json'];
  const missing = must.filter((f) => !fs.existsSync(path.join(out, f)));
  if (missing.length) throw new Error('Offline bundle is missing: ' + missing.join(', '));
  console.log('Offline bundle ready in mobile/www (' + fs.readdirSync(out).length + ' entries)');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { transform };
