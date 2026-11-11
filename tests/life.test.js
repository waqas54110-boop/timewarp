const test = require('node:test');
const assert = require('node:assert');
const L = require('../public/js/life.js');

// plays a whole life; `chooser` picks one of the open choices
function play(seed, chooser) {
  const s = L.create({ name: 'Ali', era: 'present', seed });
  let n = 0, lastAge = 0;
  while (!s.over) {
    if (s.pending) {
      const open = s.pending.choices.filter((c) => !c.locked);
      assert.ok(open.length >= 1, 'every decision has at least one open choice: ' + s.pending.id);
      L.choose(s, chooser(open, n++, s).id);
    } else {
      L.advance(s);
      assert.ok(s.age > lastAge, 'age only moves forward');
    }
    lastAge = s.age;
    L.STATS.forEach((k) => assert.ok(s[k] >= 0 && s[k] <= 100, k + ' stays in range'));
    assert.ok(s.money >= 0);
  }
  return s;
}

test('a life starts at the hospital and always ends between 62 and 90', () => {
  const s = L.create({ name: 'Sara', era: 'future', seed: 1 });
  assert.strictEqual(s.age, 0);
  assert.strictEqual(s.pending.id, 'birth');
  assert.match(s.pending.text, /smart hospital/);
  for (let seed = 1; seed <= 150; seed++) {
    const end = play(seed, (open, n) => open[(seed + n) % open.length]);
    assert.ok(end.age >= 62 && end.age <= 90, 'ends at ' + end.age);
    assert.strictEqual(end.pending, null);
    assert.ok(L.summary(end).score >= 0 && L.summary(end).score <= 100);
  }
});

test('same seed and same choices give the same life', () => {
  const a = play(42, (o, n) => o[n % o.length]), b = play(42, (o, n) => o[n % o.length]);
  assert.deepStrictEqual(a, b);
});

test('the life is plain JSON (Save mode can store it as it is)', () => {
  const s = play(5, (o) => o[0]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s)), s);
});

test('milestones come in order: school at 5, matric at 15, job at 22', () => {
  const s = play(9, (o) => o[0]);
  const ages = Object.fromEntries(s.memories.map((m) => [m.title, m.age]));
  assert.strictEqual(ages['School ka pehla din'], 5);
  assert.strictEqual(ages['Matric ka nateeja'], 15);
  assert.strictEqual(ages['Pehla kaam'], 22);
  assert.ok(s.memories.every((m, i, a) => !i || a[i - 1].age <= m.age));
});

test('choices are gated: weak marks lock Pre-Medical, no degree locks doctor', () => {
  const s = L.create({ name: 'Z', seed: 3 });
  const to = (id) => { while (!s.pending || s.pending.id !== id) { if (s.pending) L.choose(s, s.pending.choices.find((c) => !c.locked).id); else L.advance(s); } };
  to('field'); // reached at 16
  s.flags.matric = 55; s.pending = null; s.age = 15; L.advance(s);
  assert.strictEqual(s.pending.id, 'field');
  const lock = Object.fromEntries(s.pending.choices.map((c) => [c.id, c.locked]));
  assert.strictEqual(lock.premed, true); assert.strictEqual(lock.commerce, false); assert.strictEqual(lock.arts, false);
  assert.throws(() => L.choose(s, 'premed'), /locked/);
  s.flags.degree = 'none'; s.age = 21; s.pending = null; L.advance(s);
  assert.strictEqual(s.pending.id, 'job');
  const jobs = Object.fromEntries(s.pending.choices.map((c) => [c.id, c.locked]));
  assert.strictEqual(jobs.doctor, true); assert.strictEqual(jobs.business, false);
});

test('honest and cheating choices change virtues; bad inputs are rejected', () => {
  const s = L.create({ name: 'N', seed: 4 });
  assert.throws(() => L.choose(s, 'nope'), /Unknown choice/);
  s.flags = { effort: 3 }; s.pending = null; s.age = 8; L.advance(s);
  assert.strictEqual(s.pending.id, 'cheat');
  const r = L.choose(s, 'honest');
  assert.ok(s.virtues.sachai >= 3 && r.changes.sachai === 3);
  assert.throws(() => L.choose(s, 'honest'), /No decision/);
});

test('names are trimmed and limited; unknown eras fall back to present', () => {
  const s = L.create({ name: '   ' + 'a'.repeat(50), era: 'mars', seed: 1 });
  assert.strictEqual(s.name.length, 20); assert.strictEqual(s.era, 'present');
  assert.strictEqual(L.create({ name: '  ', seed: 1 }).name, 'Musafir');
});
