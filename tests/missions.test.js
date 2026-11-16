const test = require('node:test');
const assert = require('node:assert');
const M = require('../public/js/missions.js');
const LM = [{ x: 0, z: 0, label: 'Plaza' }, { x: 50, z: -20, label: 'Mosque' }, { x: -100, z: 10, label: 'Airfield' }];

test('there are 1000 different missions, in a stable order', () => {
  const all = Array.from({ length: M.TOTAL }, (_, i) => M.generate(i, LM));
  assert.strictEqual(all.length, 1000);
  assert.strictEqual(new Set(all.map((m) => m.title)).size, 1000);
  assert.strictEqual(new Set(all.map((m) => m.title + '|' + m.text)).size, 1000);
  assert.deepStrictEqual(M.generate(77, LM).text, M.generate(77, LM).text);
  all.forEach((m) => { assert.ok(m.goal >= 1 && m.reward > 0 && m.text.length > 10); if (M.needsTarget(m.type)) assert.ok(m.target); });
});

test('timed missions get slack, every type appears', () => {
  const all = Array.from({ length: 60 }, (_, i) => M.generate(i, LM));
  assert.deepStrictEqual([...new Set(all.map((m) => m.type))].sort(), [...M.TYPES].sort());
  all.filter((m) => ['run', 'race'].includes(m.type)).forEach((m) => assert.ok(m.slack > 1));
});

test('progress: reach a place on foot, counted events, time-out', () => {
  const g = M.generate(0, LM);
  assert.strictEqual(M.advance(g, { x: 30, z: 30, veh: 'foot', alt: 0 }, null, 0.1), null);
  g.target = { x: 5, z: 5 };
  assert.strictEqual(M.advance(g, { x: 5, z: 6, veh: 'car', alt: 0 }, null, 0.1), null);
  assert.strictEqual(M.advance(g, { x: 5, z: 6, veh: 'foot', alt: 0 }, null, 0.1), 'done');
  const c = M.generate(8, LM); assert.strictEqual(c.type, 'talk');
  for (let k = 0; k < c.goal - 1; k++) assert.strictEqual(M.advance(c, {}, 'talk', 0), null);
  assert.strictEqual(M.advance(c, {}, 'talk', 0), 'done');
  const r = M.generate(1, LM); r.time = 5; r.target = { x: 99, z: 99 };
  assert.strictEqual(M.advance(r, { x: 0, z: 0, veh: 'foot', alt: 0 }, null, 6), 'fail');
  const h = M.generate(4, LM); assert.strictEqual(h.type, 'heli'); h.target = { x: 0, z: 0 };
  assert.strictEqual(M.advance(h, { x: 1, z: 1, veh: 'heli', alt: 8 }, null, 0), null);
  assert.strictEqual(M.advance(h, { x: 1, z: 1, veh: 'heli', alt: 0.5 }, null, 0), 'done');
});
