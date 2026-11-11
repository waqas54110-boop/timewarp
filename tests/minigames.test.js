const test = require('node:test');
const assert = require('node:assert');
const G = require('../public/js/minigames.js');
const L = require('../public/js/life.js');
const Art = require('../public/js/life-art.js');

test('quiz: same seed gives the same questions; every question has one right option', () => {
  for (let level = 1; level <= 3; level++) {
    const a = G.makeQuiz(level, 7, 5), b = G.makeQuiz(level, 7, 5);
    assert.deepStrictEqual(a, b);
    for (let seed = 1; seed < 200; seed++) G.makeQuiz(level, seed, 5).forEach((q) => {
      assert.strictEqual(q.options.length, 4);
      assert.strictEqual(new Set(q.options).size, 4, 'options are different: ' + q.q);
      assert.ok(q.answer >= 0 && q.answer < 4);
    });
  }
  const q = G.makeQuiz(1, 3, 5);
  assert.strictEqual(G.scoreQuiz(q.map((x) => x.answer), q), 1);
  assert.strictEqual(G.scoreQuiz(q.map((x) => (x.answer + 1) % 4), q), 0);
  assert.strictEqual(G.scoreQuiz([q[0].answer], q), 0.2);
});

test('quiz maths answers are really right', () => {
  const r = G.rng(5);
  for (let i = 0; i < 300; i++) {
    const q = G.question(i % 3 + 1, r);
    const m = q.q.match(/^(\d+) ([+×−]) (\d+) = \?$/);
    if (m) { const a = +m[1], b = +m[3], want = m[2] === '+' ? a + b : m[2] === '×' ? a * b : a - b; assert.strictEqual(q.options[q.answer], String(want), q.q); }
    const sq = q.q.match(/^(\d+)² = \?$/); if (sq) assert.strictEqual(q.options[q.answer], String(sq[1] * sq[1]));
    const pc = q.q.match(/^(\d+)% of (\d+) = \?$/); if (pc) assert.strictEqual(q.options[q.answer], String(pc[1] * pc[2] / 100));
    const mx = q.q.match(/^(\d+) × (\d+) \+ (\d+) = \?$/); if (mx) assert.strictEqual(q.options[q.answer], String(mx[1] * mx[2] + +mx[3]));
  }
});

test('scores stay between 0 and 1', () => {
  assert.strictEqual(G.scoreTap(0), 0); assert.strictEqual(G.scoreTap(15), 0.5); assert.strictEqual(G.scoreTap(999), 1);
  assert.strictEqual(G.scoreMemory(4, 4), 1); assert.strictEqual(G.scoreMemory(8, 4), 0.5); assert.strictEqual(G.scoreMemory(99, 4), 0);
  assert.strictEqual(G.scoreSteady([0.5, 0.5, 0.5]), 1); assert.strictEqual(G.scoreSteady([0, 1]), 0); assert.strictEqual(G.scoreSteady([]), 0);
  for (let t = 0; t < 20; t += 0.37) { const p = G.markerAt(t, 2); assert.ok(p >= 0 && p <= 1); }
  const cards = G.makeMemory(4, 9); assert.strictEqual(cards.length, 8);
  cards.forEach((c) => assert.strictEqual(cards.filter((x) => x === c).length, 2));
});

test('a mini-game score decides the outcome of the life choice', () => {
  const s = L.create({ name: 'A', seed: 2 });
  const bad = JSON.parse(JSON.stringify(s)), good = JSON.parse(JSON.stringify(s));
  const r0 = L.choose(bad, 'smile', { score: 0 }), r1 = L.choose(good, 'smile', { score: 1 });
  assert.ok(r1.changes.happiness > r0.changes.happiness);
  assert.strictEqual(good.flags.gamesWon, 1); assert.strictEqual(bad.flags.gamesWon, undefined); assert.strictEqual(bad.flags.games, 1);
  const skipped = L.create({ name: 'A', seed: 2 });
  assert.ok(L.choose(skipped, 'smile').changes.happiness > r0.changes.happiness - 1, 'skipping is the middle result');
  assert.strictEqual(s.pending.choices.find((c) => c.id === 'smile').game, 'tap');
  const weird = L.create({ name: 'A', seed: 2 });
  L.choose(weird, 'smile', { score: 99 }); assert.ok(weird.happiness <= 100);
  const nan = L.create({ name: 'A', seed: 2 }); L.choose(nan, 'smile', { score: 'x' }); assert.strictEqual(nan.flags.games, undefined);
});

test('every stage and job has a matching picture; drawing never throws', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (k in t ? t[k] : (...a) => { calls.push(k); }) ), set: (t, k, v) => { t[k] = v; return true; } });
  L.STAGES.forEach((st) => ['past', 'present', 'future'].forEach((era) => Art.drawScene(ctx, 640, 260, { stage: st.id, era, job: 'doctor', married: true, children: 2, view: 'family' }, 1.2)));
  Object.keys(L.JOBS).forEach((job) => { assert.ok(Art.JOB_ICON[job], 'icon for ' + job); Art.drawScene(ctx, 640, 260, { stage: 'career', era: 'present', job }, 0); });
  assert.ok(calls.length > 500);
});

test('Phase 3 content: police and shopkeeper exist, each job has a working-day event, family and old-age events are reachable', () => {
  assert.ok(L.JOBS.police && L.JOBS.shopkeeper);
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const s = L.create({ name: 'A', seed });
    while (!s.over) {
      if (s.pending) {
        seen.add(s.pending.id);
        const pre = s.pending.id === 'job' ? s.pending.choices.filter((c) => !c.locked && ['police', 'shopkeeper', 'doctor', 'pilot', 'teacher', 'business', 'engineer', 'software', 'accountant'].includes(c.id)) : null;
        const ch = pre && pre.length ? pre[seed % pre.length] : s.pending.choices.find((c) => !c.locked && c.id !== 'biz') || s.pending.choices.find((c) => !c.locked);
        L.choose(s, ch.id, ch.game ? { score: (seed % 10) / 10 } : undefined);
      } else L.advance(s);
    }
  }
  ['teacher', 'newfriend', 'classtest', 'annual', 'campus', 'semester', 'kidsschool', 'kidwedding', 'oldmemories'].forEach((id) => assert.ok(seen.has(id), 'reached ' + id));
  assert.ok([...seen].some((id) => id.startsWith('work_')), 'a working-day event appeared');
});
