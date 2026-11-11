const test = require('node:test');
const assert = require('node:assert');
const C = require('../public/js/crowd.js');

test('layout: blocks and roads interleave symmetrically', () => {
  const N = 7, P = 22, cs = C.blockCenters(N, P), rs = C.roadCenters(N, P);
  assert.strictEqual(cs.length, N); assert.strictEqual(rs.length, N + 1);
  assert.strictEqual(cs[3], 0);
  for (let i = 0; i < N; i++) { assert.ok(rs[i] < cs[i] && cs[i] < rs[i + 1]); assert.strictEqual((rs[i] + rs[i + 1]) / 2, cs[i]); }
});

test('pedestrian graph: every corner has neighbours and the whole town is connected', () => {
  const N = 5, P = 22, g = C.makeGrid(N, P);
  assert.strictEqual(g.length, 4 * N * N);
  g.forEach((n) => { assert.ok(n.nb.length >= 2 && n.nb.length <= 4); n.nb.forEach((b) => assert.ok(g[b].nb.includes(b === undefined ? -1 : g.indexOf(n)))); });
  const seen = new Set([0]), q = [0];
  while (q.length) g[q.pop()].nb.forEach((b) => { if (!seen.has(b)) { seen.add(b); q.push(b); } });
  assert.strictEqual(seen.size, g.length);
});

test('pedestrians stay on sidewalks / crossings and rarely turn straight back', () => {
  const N = 5, P = 22, g = C.makeGrid(N, P);
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let cur = 0, prev = -1, backs = 0;
  for (let i = 0; i < 2000; i++) {
    const nx = C.pickNext(rand, g, cur, prev);
    assert.ok(g[cur].nb.includes(nx));
    const d = Math.hypot(g[cur].x - g[nx].x, g[cur].z - g[nx].z);
    assert.ok(Math.abs(d - 15.5) < 1e-9 || Math.abs(d - 6.5) < 1e-9, `edge length ${d}`);  // along a sidewalk or across a road
    if (nx === prev) backs++;
    prev = cur; cur = nx;
  }
  assert.strictEqual(backs, 0);
});

test('wrap keeps traffic inside the map', () => {
  assert.strictEqual(C.wrap(0, 100), 0);
  assert.strictEqual(C.wrap(60, 100), -40);
  assert.strictEqual(C.wrap(-60, 100), 40);
  assert.ok(C.wrap(12345.6, 100) >= -50 && C.wrap(12345.6, 100) < 50);
});
