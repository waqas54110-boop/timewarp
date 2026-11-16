const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const D = require('../public/js/sprite-data.js');
const media = path.join(__dirname, '..', 'public', 'media', 'sprites');
const png = (f) => { const b = fs.readFileSync(path.join(media, f)); assert.strictEqual(b.toString('latin1', 1, 4), 'PNG', f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

test('every person has the poses that their animation cycles use', () => {
  for (const kind of ['male', 'female', 'police']) {
    const names = D.FRAMES[kind]; assert.strictEqual(new Set(names).size, names.length, `${kind}: duplicate pose names`);
    for (const [move, list] of Object.entries(D.CYCLES[kind])) list.forEach((f) => assert.ok(names.includes(f), `${kind}.${move} uses missing pose ${f}`));
    ['walk', 'run', 'backwalk', 'punch', 'kick', 'handsup', 'talk', 'wave', 'dance', 'pray', 'hurt'].forEach((m) => assert.ok(D.CYCLES[kind][m], `${kind} has no ${m}`));
    assert.ok(names.includes('idle') && names.includes(D.IDLE_BACK[kind]));
  }
});

test('atlas pictures match the table: cell size, rows and pose count', () => {
  for (const kind of ['male', 'female', 'police']) {
    const { w, h } = png(`${kind}.png`), rows = Math.ceil(D.FRAMES[kind].length / D.COLS);
    assert.strictEqual(w, D.COLS * D.CELL); assert.strictEqual(h, rows * D.CELL);
  }
});

test('every vehicle has its picture, with sensible proportions and length', () => {
  for (const [name, len] of Object.entries(D.VEHICLE_LENGTH)) {
    const { w, h } = png(`v-${name}.png`); assert.ok(w / h > 1.5 && w / h < 3.2, `${name} aspect ${w / h}`); assert.ok(len > 3 && len < 20);
  }
});

test('the world page loads the pose table before world.js, and offline caching covers the pictures', () => {
  const ejs = fs.readFileSync(path.join(__dirname, '..', 'views', 'pages', 'world.ejs'), 'utf8');
  assert.ok(ejs.indexOf('/js/sprite-data.js') > 0 && ejs.indexOf('/js/sprite-data.js') < ejs.indexOf('/js/world.js'));
  assert.ok(ejs.includes('id="hero-look"'));
  const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
  assert.ok(sw.includes('sprites'));
});

test('sprites.js picks the right picture: back view when walking away, mirrored when going left, cars mirrored by direction', () => {
  const helpers = path.join(__dirname, 'helpers');
  const r = spawnSync(process.execPath, ['--no-warnings', '--import', path.join(helpers, 'register.mjs'), path.join(helpers, 'sprites-run.mjs')], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /sprites-run ok/);
});
