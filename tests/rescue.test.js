// Rescue 1122 (public/js/rescue.js): the rules (time, people, rewards, site choice) and a full simulated rescue with the real three.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const THREE_URL = pathToFileURL(path.join(__dirname, '..', 'node_modules', 'three', 'build', 'three.module.js')).href;

async function load() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'rescue.js'), 'utf8')
    .replace("'/vendor/three/three.module.js'", JSON.stringify(THREE_URL));
  return import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
}

const el = () => { const e = { style: {}, children: [], hidden: false, textContent: '', listeners: {}, setAttribute() {}, appendChild(c) { e.children.push(c); }, addEventListener(n, f) { e.listeners[n] = f; }, querySelector: (q) => (e.q[q] = e.q[q] || el()) }; e.q = {}; return e; };

test('levels, people, time and rewards behave', async () => {
  const R = await load();
  assert.equal(R.levelFor(0), 1); assert.equal(R.levelFor(3), 2); assert.equal(R.levelFor(999), R.LEVEL_MAX);
  assert.equal(R.peopleCount(1), 1); assert.equal(R.peopleCount(4), 2); assert.equal(R.peopleCount(10), 4);
  assert.ok(R.timeLimit(0, 10) >= 30); assert.ok(R.timeLimit(300, 1) > R.timeLimit(100, 1)); assert.ok(R.timeLimit(200, 10) < R.timeLimit(200, 1));
  assert.ok(R.nextDelay(10, 1) < R.nextDelay(1, 1)); assert.ok(R.nextDelay(10, 0) >= 25);
  assert.equal(R.reward(1, 0, 2, 30, 60), 0);
  assert.ok(R.reward(1, 2, 2, 30, 60) > R.reward(1, 1, 2, 30, 60) * 2);          // saving everyone pays a bonus
  assert.ok(R.reward(5, 1, 1, 50, 60) > R.reward(5, 1, 1, 0, 60));                // faster pays more
});

test('pickSite prefers a crossing far from the player', async () => {
  const R = await load();
  const sites = [{ label: 'the helipad', x: 0, z: 0 }, { label: 'the near crossing', x: 5, z: 5 }, { label: 'the far crossing', x: 99, z: 99 }];
  for (let i = 0; i < 20; i++) assert.equal(R.pickSite(sites, { x: 0, z: 0 }, Math.random).label, 'the far crossing');
  assert.equal(R.pickSite([{ label: 'the near crossing', x: 1, z: 1 }], { x: 0, z: 0 }, () => 0).label, 'the near crossing');
});

test('a full rescue: alert, pick up, hospital, reward, next emergency', async () => {
  const R = await load();
  const THREE = await import(THREE_URL);
  const store = {}; global.localStorage = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } };
  global.document = { createElement: () => el() };
  const scene = new THREE.Scene(), said = [], puffs = [], me = { x: 0, y: 0, z: 0 }; let money = 0, busy = false;
  const r = R.create({ scene, say: (t) => said.push(t), puff: (...a) => puffs.push(a), pos: () => me, addMoney: (n) => { money += n; }, rnd: Math.random, root: el(),
    sites: [{ label: 'the town centre crossing', x: 100, z: 0, open: true }], hospital: { x: -150, z: -55 }, solid: () => {}, isBusy: () => busy });
  const DT = 0.1, step = (sec) => { for (let t = 0; t < sec; t += DT) r.update(DT); };

  busy = true; step(120); assert.equal(r.active, false);                          // never starts while the player is busy (praying, story)
  busy = false; step(60); assert.equal(r.active, true);                           // first emergency within a minute
  assert.match(said.join(' '), /EMERGENCY/);
  step(1); assert.ok(puffs.length > 0, 'fire and smoke are drawn');

  me.x = 100; me.z = 0;                                                           // run to the crossing
  let tg = null; for (let i = 0; i < 200 && !tg; i++) { me.x = 100 + (i % 21) - 10; me.z = (i % 17) - 8; step(0.1); tg = r.target(me); }
  assert.ok(tg && tg.type === 'x-rescue', 'a trapped person can be picked up');
  r.act(tg); assert.equal(r.target(me) === null || r.target(me).v !== tg.v, true, 'the same person cannot be picked up twice');
  for (let i = 0; i < 30 && r.active; i++) { const t2 = r.target({ x: tg.v.x, z: tg.v.z }); if (!t2) break; r.act(t2); }

  me.x = -150; me.z = -55; step(0.5);                                             // drive to the hospital
  assert.ok(money > 0, 'reward paid');
  assert.equal(r.active, false, 'the emergency is over');
  assert.equal(r.stats.done, 1); assert.ok(r.stats.saved >= 1);
  assert.ok(JSON.parse(store['timewarp-rescue']).done === 1, 'progress is saved');
  let again = false; for (let t = 0; t < 200 && !again; t += DT) { r.update(DT); again = r.active; }
  assert.equal(again, true, 'the next emergency comes later');
});

test('people are lost when the time runs out', async () => {
  const R = await load();
  const THREE = await import(THREE_URL);
  const store = {}; global.localStorage = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } };
  global.document = { createElement: () => el() };
  const said = [], me = { x: 0, y: 0, z: 0 }; let money = 0;
  const r = R.create({ scene: new THREE.Scene(), say: (t) => said.push(t), puff: () => {}, pos: () => me, addMoney: (n) => { money += n; }, rnd: Math.random, root: el(),
    sites: [{ label: 'the far crossing', x: 200, z: 0 }], hospital: { x: -150, z: -55 }, solid: () => {}, isBusy: () => false });
  for (let t = 0; t < 400; t += 0.1) r.update(0.1);
  assert.equal(money, 0); assert.ok(r.stats.lost >= 1); assert.match(said.join(' '), /nahi bach sake/);
});
