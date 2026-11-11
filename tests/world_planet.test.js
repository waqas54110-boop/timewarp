// Planet data for the Live World: files exist, have the right size and the lists are sane.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
const png = (f) => { const b = fs.readFileSync(path.join(pub, 'media', f)); assert.strictEqual(b.toString('latin1', 1, 4), 'PNG'); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

test('biome/country map and coast field have the expected sizes', () => {
  assert.deepStrictEqual(png('world-ids.png'), { w: 4096, h: 2048 });
  assert.deepStrictEqual(png('world-sdf.png'), { w: 2048, h: 1024 });
});
test('countries.json lists every country with a name, flag and index', () => {
  const c = JSON.parse(fs.readFileSync(path.join(pub, 'data', 'countries.json'), 'utf8'));
  assert.ok(c.length >= 230 && c.length <= 255);
  c.forEach((x, i) => { assert.strictEqual(x.i, i + 1); assert.ok(x.n); });
  const pk = c.find((x) => x.n === 'Pakistan'); assert.ok(pk); assert.ok(pk.px > 5000);
  assert.ok(c.find((x) => x.n === 'United Arab Emirates'));
});
test('cities.json has big cities with sane coordinates', () => {
  const c = JSON.parse(fs.readFileSync(path.join(pub, 'data', 'cities.json'), 'utf8'));
  assert.ok(c.length > 60);
  c.forEach((x) => { assert.ok(Math.abs(x.lat) <= 90 && Math.abs(x.lng) <= 180 && x.s >= 1 && x.s <= 5); });
  assert.ok(c.some((x) => x.n === 'Lahore') && c.some((x) => x.n === 'Dubai'));
});
