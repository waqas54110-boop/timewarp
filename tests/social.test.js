const test = require('node:test');
const assert = require('node:assert');
const Crowd = require('../public/js/crowd.js');
const { createSim } = require('../public/js/social.js');

const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const N = 5, P = 22, HALF = (N * P) / 2;
function shopsFor() { // one shopfront per side of the middle block, like the 3D page makes them
  return [{ x: -3.1, z: 6.5, yaw: 0, name: 'Cafe' }, { x: 3.1, z: -6.5, yaw: Math.PI, name: 'Bakery' }, { x: -6.5, z: 0, yaw: -Math.PI / 2, name: 'Tailor' }, { x: 6.5, z: 0, yaw: Math.PI / 2, name: 'Grocery' }];
}
function run(sim, seconds, dt = 0.1, each) { for (let t = 0; t < seconds; t += dt) { sim.step(dt); if (each) each(); } }
const seen = (sim, type) => sim.log.some((e) => e.type === type);

test('graph helpers: shortest path and nearest node', () => {
  const g = Crowd.makeGrid(N, P);
  const a = 0, b = g.length - 1, path = Crowd.shortestPath(g, a, b);
  assert.strictEqual(path[0], a); assert.strictEqual(path.at(-1), b);
  for (let i = 1; i < path.length; i++) assert.ok(g[path[i - 1]].nb.includes(path[i]));
  assert.deepStrictEqual(Crowd.shortestPath(g, 3, 3), [3]);
  assert.strictEqual(Crowd.nearestNode(g, g[7].x + 0.3, g[7].z - 0.2), 7);
});

test('a busy street: everyone stays finite and inside the map, people chat and shops make sales', () => {
  const sim = createSim({ rand: seeded(11), N, P, citizens: 30, police: 3, shops: shopsFor(), fightRate: 0 });
  run(sim, 600, 0.1, () => sim.agents.forEach((a) => {
    assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z) && Number.isFinite(a.yaw));
    assert.ok(Math.abs(a.x) <= HALF && Math.abs(a.z) <= HALF);
  }));
  assert.ok(sim.agents.some((a) => a.mode === 'chat') || sim.log.length > 0);
  assert.ok(seen(sim, 'sale'), 'a shopkeeper sold something');
  assert.ok(!seen(sim, 'fight'), 'fights are off at rate 0');
  sim.shops.forEach((s) => assert.ok(!s.keeper.partner || s.keeper.partner.mode === 'shop' || s.keeper.partner.mode === 'trade'));
});

test('a scuffle brings the police, who break it up and send people on their way', () => {
  const sim = createSim({ rand: seeded(5), N, P, citizens: 30, police: 4, shops: shopsFor(), fightRate: 0.6 });
  run(sim, 400);
  assert.ok(seen(sim, 'fight'), 'a fight happened');
  assert.ok(seen(sim, 'police'), 'police arrived');
  assert.ok(seen(sim, 'detain'), 'the fighters were warned and released');
  const resolved = sim.alerts.filter((a) => a.resolved && a.arrived);
  assert.ok(resolved.length >= 1);
  // nobody is stuck: no one stays fighting / handcuffed / responding for ages
  const stuckLimit = 60; const since = new Map();
  run(sim, 200, 0.1, () => sim.agents.forEach((a) => {
    const bad = ['fight', 'detained', 'respond', 'cuff'].includes(a.mode);
    if (!bad) return since.delete(a.id);
    const t0 = since.get(a.id) ?? sim.time; since.set(a.id, t0);
    assert.ok(sim.time - t0 < stuckLimit, `agent ${a.id} stuck in ${a.mode}`);
  }));
});

test('without police a scuffle calms down by itself', () => {
  const sim = createSim({ rand: seeded(9), N, P, citizens: 30, police: 0, fightRate: 0.8 });
  run(sim, 300);
  assert.ok(seen(sim, 'fight')); assert.ok(seen(sim, 'calm')); assert.ok(!seen(sim, 'police'));
  assert.ok(!sim.agents.some((a) => a.mode === 'fight' && sim.time - sim.alerts.find((x) => x === a.alert).started > 30));
});

test('future: flyers stay in the air and keep moving; keepers stay put', () => {
  const sim = createSim({ rand: seeded(3), N, P, citizens: 5, police: 1, flyers: 8, shops: shopsFor() });
  const fl = sim.agents.filter((a) => a.flyer), before = fl.map((a) => [a.x, a.z]);
  run(sim, 60);
  assert.strictEqual(fl.length, 8); fl.forEach((a, i) => { assert.ok(a.alt >= 5 && a.mode === 'walk'); assert.ok(Math.hypot(a.x - before[i][0], a.z - before[i][1]) > 0.1); });
  sim.agents.filter((a) => a.role === 'keeper').forEach((k, i) => { assert.strictEqual(k.x, shopsFor()[i].x); assert.strictEqual(k.z, shopsFor()[i].z); });
});

test('the visitor can start a scuffle: police come, the visitor is held, the other person goes back to routine', () => {
  const sim = createSim({ rand: seeded(21), N, P, citizens: 25, police: 4, shops: shopsFor(), fightRate: 0 });
  run(sim, 20);
  const target = sim.agents.find((a) => a.role === 'citizen' && !a.flyer && (a.mode === 'walk' || a.mode === 'pause'));
  sim.player.x = target.x + 1; sim.player.z = target.z;
  assert.ok(sim.engagePlayer(target)); assert.strictEqual(target.mode, 'fight'); assert.strictEqual(target.partner, sim.player);
  run(sim, 90, 0.1, () => { sim.player.x = target.x + 1; sim.player.z = target.z; });
  assert.ok(seen(sim, 'police'), 'police arrived');
  assert.ok(sim.player.warned >= 1, 'the visitor was warned');
  assert.ok(sim.player.detainedUntil > 0);
  assert.ok(!['fight', 'detained'].includes(target.mode), 'the other person went back to routine');
});

test('walking away from a scuffle you started ends it without police', () => {
  const sim = createSim({ rand: seeded(4), N, P, citizens: 12, police: 0, shops: shopsFor(), fightRate: 0 });
  run(sim, 5);
  const t = sim.agents.find((a) => a.role === 'citizen' && (a.mode === 'walk' || a.mode === 'pause'));
  sim.player.x = t.x; sim.player.z = t.z; sim.engagePlayer(t);
  sim.player.x += 40; run(sim, 3);
  assert.ok(seen(sim, 'calm')); assert.ok(t.mode !== 'fight');
});

test('shopkeepers who are pulled into a scuffle or a talk return to their spot', () => {
  const sim = createSim({ rand: seeded(8), N, P, citizens: 5, police: 2, shops: shopsFor(), fightRate: 0 });
  const k = sim.agents.find((a) => a.role === 'keeper'), home = { x: k.x, z: k.z, yaw: k.yaw };
  sim.player.x = k.x; sim.player.z = k.z + 1;
  assert.ok(sim.hold(k)); assert.strictEqual(k.mode, 'listen'); run(sim, 2); sim.release(k);
  assert.strictEqual(k.mode, 'stand'); assert.deepStrictEqual({ x: k.x, z: k.z }, { x: home.x, z: home.z });
  assert.ok(sim.engagePlayer(k)); run(sim, 120, 0.1, () => { sim.player.x = k.x; sim.player.z = k.z + 1; });
  assert.strictEqual(k.mode, 'stand'); assert.strictEqual(k.x, home.x); assert.strictEqual(k.z, home.z);
});

test('people talk in turns with real sentences', () => {
  const lines = ['Line A is here.', 'Line B is here.', 'Line C is here.'];
  const sim = createSim({ rand: seeded(2), N, P, citizens: 30, police: 0, fightRate: 0, chatLines: lines });
  const said = new Set(); let both = 0;
  run(sim, 300, 0.1, () => sim.agents.filter((a) => a.mode === 'chat').forEach((a) => {
    if (a.bubble) { said.add(a.bubble); assert.ok(lines.includes(a.bubble)); if (a.partner.bubble) both++; }
  }));
  assert.ok(said.size >= 2, 'several different sentences were spoken'); assert.strictEqual(both, 0, 'never both at once');
});
