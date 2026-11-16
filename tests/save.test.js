const test = require('node:test');
const assert = require('node:assert');
const L = require('../public/js/life.js');
const { sanitize, present, continueUrl } = require('../services/saveService.js');
const S = require('../public/js/save.js');

function lifeAt(seed, stopAge) {
  const s = L.create({ name: 'Ali', era: 'past', seed });
  while (!s.over && !(s.age >= stopAge && s.pending)) { if (s.pending) L.choose(s, s.pending.choices.find((c) => !c.locked).id); else L.advance(s); }
  return s;
}
const fakeStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };

// ---------- Phase 2: Life JSON <-> save ----------
test('a life saved in the middle and restored plays on exactly like the original', () => {
  const a = lifeAt(11, 30);
  const b = L.restore(JSON.parse(JSON.stringify(a)));
  assert.deepStrictEqual(b, a);
  for (const s of [a, b]) { while (!s.over) { if (s.pending) L.choose(s, s.pending.choices.find((c) => !c.locked).id); else L.advance(s); } }
  assert.deepStrictEqual(b, a, 'same random numbers, same ending');
});

test('restore refuses garbage and clamps edited numbers', () => {
  assert.strictEqual(L.restore(null), null);
  assert.strictEqual(L.restore({ v: 2 }), null);
  assert.strictEqual(L.restore('life'), null);
  const a = JSON.parse(JSON.stringify(lifeAt(2, 20)));
  const evil = Object.assign({}, a, { health: 9999, money: -5, age: 500, name: '<b>' + 'x'.repeat(60), pending: { id: 'no-such-event' } });
  assert.strictEqual(L.restore(evil), null, 'unknown pending event');
  evil.pending = a.pending;
  const r = L.restore(evil);
  assert.strictEqual(r.health, 100); assert.strictEqual(r.money, 0); assert.strictEqual(r.age, 120); assert.strictEqual(r.name.length, 20);
  a.pending.choices[0].label = 'forged'; a.pending.text = 'forged';
  assert.notStrictEqual(L.restore(a).pending.text, 'forged', 'event text is rebuilt from the game, not trusted');
});

test('a saved life stays small enough for the API', () => {
  assert.ok(JSON.stringify(lifeAt(3, 70)).length < 30000);
});

// ---------- Phase 1: server rules ----------
test('sanitize accepts a life and a world part, and rejects bad data', () => {
  const life = lifeAt(5, 25);
  const a = sanitize({ life });
  assert.strictEqual(a.lastMode, 'life'); assert.strictEqual(a.era, 'past'); assert.ok(a.life.age >= 25);
  const w = sanitize({ world: { mode: 'future', year: 2050, destinationId: 3, x: 10.4, z: -20, money: 1500, mission: 7 } });
  assert.deepStrictEqual(w.position, { mode: 'future', x: 10, z: -20 });
  assert.strictEqual(w.year, 2050); assert.strictEqual(w.money, 1500); assert.strictEqual(w.mission, 7); assert.strictEqual(w.lastMode, 'world');
  assert.strictEqual(w.life, undefined, 'a world save does not touch the life');
  assert.throws(() => sanitize({}), /Nothing to save/);
  assert.throws(() => sanitize(null), /Nothing to save/);
  assert.throws(() => sanitize({ life: { v: 1, pending: { id: 'x' } } }), /valid TimeWarp life/);
  assert.throws(() => sanitize({ world: { mode: 'mars', year: 1 } }), /world.mode/);
  assert.throws(() => sanitize({ world: { mode: 'past', year: 99999 } }), /world.year/);
  assert.throws(() => sanitize({ world: { mode: 'past', year: 1900, money: -1 } }), /world.money/);
  assert.throws(() => sanitize({ world: { mode: 'past', year: 1900, mission: 'abc' } }), /world.mission/);
  assert.throws(() => sanitize({ world: { mode: 'past', year: 1900, x: 1e9 } }), /world.x/);
  try { sanitize({}); } catch (e) { assert.strictEqual(e.status, 400); }
});

test('present() and continueUrl() point Continue to the right place', () => {
  assert.strictEqual(continueUrl(null), null);
  const life = lifeAt(6, 10);
  const lifeRow = { last_mode: 'life', era: 'past', year: null, position: null, life, saved_at: 'now' };
  assert.strictEqual(continueUrl(present(lifeRow)), '/life?continue=1');
  const worldRow = { last_mode: 'world', era: 'present', year: 2026, destination_id: 4, position: { mode: 'present', x: 1, z: 2 }, money: 900, mission_progress: 3, life, saved_at: 'now' };
  assert.strictEqual(continueUrl(present(worldRow)), '/world?mode=present&year=2026&destinationId=4&continue=1');
  assert.deepStrictEqual(present(worldRow).world, { mode: 'present', year: 2026, destinationId: 4, x: 1, z: 2, money: 900, mission: 3 });
  assert.strictEqual(continueUrl(present({ last_mode: 'life', era: 'past', year: null, position: null, life: null })), null);
});

// ---------- Phase 1: browser side ----------
test('guest save goes to local storage and loads back; New Life clears only the life', async () => {
  const storage = fakeStorage();
  const sv = S.create({ storage, fetchFn: () => { throw new Error('guests never call the server'); }, auth: false });
  assert.strictEqual(await sv.load(), null);
  const life = lifeAt(8, 15);
  await sv.save('life', life);
  await sv.save('world', { mode: 'past', year: 1947, x: 1, z: 2, money: 10, mission: 4 });
  const got = await sv.load();
  assert.deepStrictEqual(got.life, life); assert.strictEqual(got.world.mission, 4); assert.strictEqual(got.lastMode, 'world');
  await sv.clear('life');
  const after = await sv.load();
  assert.strictEqual(after.life, null); assert.ok(after.world);
  await sv.clear();
  assert.strictEqual(await sv.load(), null);
  assert.throws(() => sv.save('video', {}), /part must be/);
});

test('guest save survives blocked or broken storage without throwing', async () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const sv = S.create({ storage: blocked, fetchFn: () => {}, auth: false });
  const seen = []; sv.onStatus((s) => seen.push(s));
  assert.strictEqual(await sv.save('life', lifeAt(1, 5)), false);
  assert.deepStrictEqual(seen, ['error']);
  assert.strictEqual(await sv.load(), null);
  const bad = fakeStorage(); bad.m[S.KEY] = '{not json';
  assert.strictEqual(await S.create({ storage: bad, fetchFn: () => {}, auth: false }).load(), null);
});

test('signed-in save: CSRF header, throttled, last change always sent; load and clear use the API', async () => {
  const calls = []; let t = 100000; const timers = [];
  const fetchFn = async (url, o) => { calls.push({ url, o }); return { ok: true, json: async () => ({ save: { lastMode: 'life', life: null, world: null } }) }; };
  const sv = S.create({ storage: fakeStorage(), fetchFn, csrf: 'tok123', auth: true, now: () => t, timers: { set: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clear: () => {} } });
  await sv.save('life', { n: 1 });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, '/api/save'); assert.strictEqual(calls[0].o.method, 'POST');
  assert.strictEqual(calls[0].o.headers['x-csrf-token'], 'tok123');
  assert.deepStrictEqual(JSON.parse(calls[0].o.body), { life: { n: 1 } });
  t += 1000; sv.save('life', { n: 2 }); sv.save('life', { n: 3 }); sv.save('world', { w: 1 });
  assert.strictEqual(calls.length, 1, 'throttled');
  assert.strictEqual(timers.length, 1); assert.strictEqual(timers[0].ms, S.MIN_GAP - 1000);
  t += S.MIN_GAP; await timers[0].fn();
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(JSON.parse(calls[1].o.body), { life: { n: 3 }, world: { w: 1 } }, 'only the newest of each part is sent');
  await sv.load(); assert.strictEqual(calls[2].url, '/api/load');
  await sv.clear('life'); assert.strictEqual(calls[3].url, '/api/save?part=life'); assert.strictEqual(calls[3].o.method, 'DELETE');
  assert.strictEqual(calls[3].o.headers['x-csrf-token'], 'tok123');
});

test('signed-in save reports a failed request and load returns null on server error', async () => {
  const sv = S.create({ storage: fakeStorage(), fetchFn: async () => { throw new Error('offline'); }, csrf: 'x', auth: true });
  const seen = []; sv.onStatus((s) => seen.push(s));
  assert.strictEqual(await sv.save('life', { n: 1 }), false);
  assert.ok(seen.includes('error'));
  assert.strictEqual(await sv.load(), null);
  assert.strictEqual(await S.create({ storage: fakeStorage(), fetchFn: async () => ({ ok: false }), auth: true }).load(), null);
});
