const test = require('node:test');
const assert = require('node:assert');
const L = require('../public/js/life.js');
const G = require('../public/js/minigames.js');

// plays a whole life; `plan(s)` may buy things before each decision. Games get a score from the seed so replays have game scores too.
function play(seed, opts, plan) {
  const s = L.create(Object.assign({ name: 'Ali', seed }, opts));
  for (let g = 0; g < 5000 && !s.over; g++) {
    if (plan) plan(s);
    if (s.pending) { const ch = s.pending.choices.find((c) => !c.locked && (!c.game || seed % 2)) || s.pending.choices.find((c) => !c.locked); L.choose(s, ch.id, ch.game ? { score: ((seed * 7 + s.age) % 11) / 10 } : undefined); }
    else L.advance(s);
  }
  return s;
}
const rich = (s) => { s.money = Math.max(s.money, 90000000); };

test('home, things and pets: buying rules, slots, prices and yearly effects', () => {
  const s = L.create({ name: 'A', seed: 3 });
  assert.strictEqual(L.act(s, 'home', 'flat').ok, false, 'a baby cannot buy a home');
  assert.match(L.act(s, 'item', 'tv').why, /18 saal/);
  s.age = 30; s.money = 10000000;
  const before = s.money, p = L.price(s, 6000000);
  assert.ok(p > 6000000, 'prices rise with age');
  assert.strictEqual(L.act(s, 'home', 'flat').ok, true); assert.strictEqual(s.money, before - p);
  assert.strictEqual(L.act(s, 'home', 'rent').ok, false, 'no going back to a worse home');
  assert.strictEqual(L.act(s, 'home', 'flat').ok, false);
  assert.strictEqual(L.homeTier(s), 1);
  s.money = 90000000;
  ['bed', 'books', 'musalla', 'tv', 'ac'].forEach((id) => assert.strictEqual(L.act(s, 'item', id).ok, true, id));
  assert.match(L.act(s, 'item', 'computer').why, /jagah/, 'the flat has 5 slots');
  assert.strictEqual(L.act(s, 'item', 'car').ok, true, 'vehicles do not need a slot');
  assert.strictEqual(L.act(s, 'item', 'car').ok, false, 'already owned');
  const m = s.money; assert.strictEqual(L.act(s, 'sell', 'tv').ok, true); assert.ok(s.money > m);
  assert.strictEqual(L.act(s, 'pet', 'horse').ok, false, 'horse needs a bigger home');
  assert.strictEqual(L.act(s, 'pet', 'cat').ok, true); L.act(s, 'pet', 'dog'); L.act(s, 'pet', 'parrot');
  assert.match(L.act(s, 'pet', 'fish').why, /3 janwar/);
  assert.strictEqual(L.act(s, 'nonsense', 'x').ok, false);
  s.flags.job = 'doctor'; s.happiness = 40; s.pending = null; L.advance(s);
  assert.ok(s.happiness > 40, 'home, things and pets help every year');
});

test('children get a free first pet, but not an expensive one; pets die of old age', () => {
  const s = L.create({ name: 'A', seed: 4 }); s.age = 9; s.money = 0;
  assert.strictEqual(L.act(s, 'pet', 'cat').ok, true); assert.strictEqual(s.money, 0);
  assert.strictEqual(L.act(s, 'pet', 'dog').ok, false);
  const fish = L.create({ name: 'A', seed: 4 }); fish.age = 8; L.act(fish, 'pet', 'fish');
  fish.age = 12; fish.pending = null; const h = fish.happiness; L.advance(fish);
  assert.strictEqual(fish.pets.length, 0, 'a fish lives 4 years'); assert.ok(fish.memories.some((m) => /chal basa/.test(m.text)));
  assert.ok(fish.log.some((l) => /nahi raha/.test(l.text)));
});

test('rent is paid by workers without their own home', () => {
  const a = L.create({ name: 'A', seed: 6 }); a.age = 30; a.flags.job = 'doctor'; a.money = 5000000; a.pending = null;
  const b = JSON.parse(JSON.stringify(a)), lb = L.restore(b); lb.home = 'flat'; lb.pending = null;
  L.advance(a); L.advance(lb);
  assert.ok(a.money < 5000000 + L.monthlyBase(a) * 12, 'rent reduces savings');
  assert.ok(lb.money > a.money, 'owner keeps more');
});

test('dream and goals: a dream adds 5 to the score only if it came true', () => {
  const s = L.create({ name: 'A', seed: 8, dream: 'doctor' });
  assert.strictEqual(L.goals(s)[0].id, 'doctor'); assert.strictEqual(L.goals(s)[0].dream, true);
  const base = JSON.parse(JSON.stringify(s)); s.flags.job = 'doctor'; base.flags.job = 'teacher';
  const a = L.summary(s), b = L.summary(L.restore(base));
  assert.strictEqual(a.dreamDone, true); assert.strictEqual(b.dreamDone, false); assert.strictEqual(a.dream, 'Doctor banna');
  assert.strictEqual(L.create({ name: 'A', seed: 8, dream: 'xx' }).dream, null);
  assert.ok(L.goals(s).find((g) => g.id === 'pets'));
});

test('diary: own notes are kept with the memories, capped and trimmed', () => {
  const s = L.create({ name: 'A', seed: 2 }); s.age = 20;
  assert.strictEqual(L.addDiary(s, '   '), false);
  assert.strictEqual(L.addDiary(s, 'Aaj ka din bohat acha tha ' + 'x'.repeat(300)), true);
  for (let i = 0; i < 120; i++) L.addDiary(s, 'note ' + i);
  assert.strictEqual(s.diary.length, 100);
  s.memories.push({ age: 5, icon: '🎒', title: 'School', text: 't' });
  const e = L.diaryEntries(s); assert.strictEqual(e[0].age, 5); assert.ok(e.some((x) => x.mine));
  const r = L.restore(JSON.parse(JSON.stringify(s))); assert.strictEqual(r.diary.length, 100); assert.ok(r.diary.every((d) => d.text.length <= 240));
});

test('family tree grows with the life', () => {
  const s = L.create({ name: 'Ali', seed: 2 });
  assert.deepStrictEqual(L.familyTree(s).map((n) => n.id), ['g1', 'g2', 'dad', 'mom', 'me']);
  s.flags.married = true; s.flags.children = 1; s.age = 60; L.act(Object.assign(s, { money: 1e8 }), 'pet', 'cat');
  const ids = L.familyTree(s).map((n) => n.id);
  ['spouse', 'c1', 'c2', 'gc1', 'gc2', 'pet0'].forEach((id) => assert.ok(ids.includes(id), id));
});

test('time capsule: sealed for N years, opens as a decision, and only once', () => {
  const s = L.create({ name: 'A', seed: 5 });
  assert.strictEqual(L.act(s, 'capsule', 'x', { text: '', years: 10 }).ok, false);
  assert.strictEqual(L.act(s, 'capsule', 'x', { text: 'hello', years: 1 }).ok, false);
  assert.strictEqual(L.act(s, 'capsule', 'x', { text: 'Main doctor ban gaya?', years: 5 }).ok, true);
  assert.strictEqual(L.act(s, 'capsule', 'x', { text: 'again', years: 5 }).ok, false);
  let opened = 0, ageAtOpen = null;
  for (let g = 0; g < 400 && !s.over; g++) {
    if (s.pending) { if (s.pending.id === 'capsule') { opened++; ageAtOpen = s.age; assert.match(s.pending.text, /Main doctor ban gaya/); } L.choose(s, s.pending.choices[0].id); } else L.advance(s);
  }
  assert.strictEqual(opened, 1); assert.ok(ageAtOpen >= 5);
  const r = L.restore(JSON.parse(JSON.stringify(s))); assert.strictEqual(r.capsule.opened, true);
});

test('perks change the start of a new life', () => {
  const s = L.create({ name: 'A', seed: 2, perks: ['rich', 'scholar', 'healthy', 'friends', 'joy', 'mentor', 'nope', 'rich'] });
  assert.strictEqual(s.money, 2000000); assert.strictEqual(s.knowledge, 15); assert.strictEqual(s.health, 80); assert.strictEqual(s.relations, 70); assert.strictEqual(s.happiness, 70); assert.strictEqual(s.flags.effort, 4);
  assert.deepStrictEqual(s.perks.sort(), ['friends', 'healthy', 'joy', 'mentor', 'rich', 'scholar']);
  assert.deepStrictEqual(L.restore(JSON.parse(JSON.stringify(s))).perks.sort(), s.perks.sort());
});

test('Butterfly Effect: replaying every saved decision gives exactly the same life', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const s = play(seed, { perks: ['rich'], dream: seed % 3 === 0 ? 'family' : 'rich' }, (x) => {
      if (x.age >= 25 && x.age % 5 === 0) { L.act(x, 'home', 'flat'); L.act(x, 'item', 'books'); L.act(x, 'item', 'bike'); L.act(x, 'pet', 'cat'); L.act(x, 'home', 'house'); }
      if (x.age === 35 && !x.capsule) L.act(x, 'capsule', 'k', { text: 'hi', years: 10 });
    });
    assert.ok(s.hist.some((h) => h.a === 'item'), 'something was bought, seed ' + seed);
    assert.ok(s.over); assert.ok(L.verify(s), 'seed ' + seed);
    const back = L.restore(JSON.parse(JSON.stringify(s)));
    assert.ok(L.verify(back), 'still verifies after save and load, seed ' + seed);
  }
});

test('verify rejects typed-in lives, tampered stats and lives without history', () => {
  const s = play(11);
  const cheat = L.restore(JSON.parse(JSON.stringify(s))); cheat.money += 5000000; assert.strictEqual(L.verify(cheat), false);
  const cheat2 = L.restore(JSON.parse(JSON.stringify(s))); cheat2.flags.job = 'pilot'; assert.strictEqual(L.verify(cheat2), false);
  const cheat3 = L.restore(JSON.parse(JSON.stringify(s))); cheat3.hist.pop(); assert.strictEqual(L.verify(cheat3), false);
  const cheat4 = L.restore(JSON.parse(JSON.stringify(s))); cheat4.hist[3].c = cheat4.hist[3].o[cheat4.hist[3].o.length - 1] === cheat4.hist[3].c ? cheat4.hist[3].o[0] : cheat4.hist[3].o[cheat4.hist[3].o.length - 1]; assert.strictEqual(L.verify(cheat4), false);
  const old = L.restore(JSON.parse(JSON.stringify(s))); old.seed0 = null; assert.strictEqual(L.verify(old), false);
  const half = L.create({ name: 'A', seed: 2 }); assert.strictEqual(L.verify(half), false, 'not finished');
  assert.strictEqual(L.verify(null), false);
});

test('Butterfly Effect: one changed decision gives a different life and a comparison', () => {
  const s = play(21);
  const alts = L.alternatives(s); assert.ok(alts.length > 10);
  alts.forEach((a) => { assert.ok(a.options.length >= 2); assert.ok(a.options.some((o) => o.id === a.chosen)); assert.ok(a.title); });
  const a = alts.find((x) => x.age >= 22 && x.age <= 26) || alts[Math.floor(alts.length / 2)];
  const other = a.options.find((o) => o.id !== a.chosen);
  const w = L.whatIf(s, a.i, other.id);
  assert.ok(w.life.over); assert.ok(w.cmp.score[0] >= 0 && w.cmp.score[1] >= 0);
  assert.strictEqual(w.cmp.score[0], L.summary(s).score, 'the first number is the real life');
  assert.notStrictEqual(L.fingerprint(w.life), L.fingerprint(s), 'something changed');
  assert.throws(() => L.whatIf(s, a.i, 'no-such-choice'), /open decision/);
  assert.strictEqual(L.verify(s), true, 'the real life is untouched');
  const old = L.restore(JSON.parse(JSON.stringify(s))); old.seed0 = null; assert.deepStrictEqual(L.alternatives(old), []);
});

test('restore keeps Phase 5 data and cleans bad Phase 5 data', () => {
  const s = play(9, { dream: 'rich' }, (x) => { if (x.age === 30 && !x.pets.length) { rich(x); L.act(x, 'pet', 'cat'); L.act(x, 'item', 'car'); } });
  const r = L.restore(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(r.items, s.items); assert.strictEqual(r.dream, 'rich'); assert.strictEqual(r.seed0, s.seed0); assert.strictEqual(r.hist.length, s.hist.length);
  const evil = JSON.parse(JSON.stringify(s));
  evil.items = ['car', 'car', 'rocket', 7]; evil.pets = [{ id: 'dragon', since: 1 }, { id: 'cat', since: -50 }]; evil.home = 'palace'; evil.dream = 'x'; evil.perks = ['god', 'rich']; evil.hist = [null, { a: 'hack', id: 1 }, { e: 'nope' }, 5];
  const c = L.restore(evil);
  assert.deepStrictEqual(c.items, ['car']); assert.deepStrictEqual(c.pets, [{ id: 'cat', since: 0 }]); assert.strictEqual(c.home, 'rent'); assert.strictEqual(c.dream, null); assert.deepStrictEqual(c.perks, ['rich']); assert.deepStrictEqual(c.hist, []);
  const v1 = { v: 1, name: 'Old', era: 'present', rs: 5, age: 10, health: 70, knowledge: 30, happiness: 60, relations: 60, money: 0, virtues: {}, flags: {}, seen: {}, log: [], memories: [] };
  const o = L.restore(v1); assert.strictEqual(o.seed0, null); assert.deepStrictEqual(o.items, []); assert.strictEqual(o.home, 'rent');
});

test('jobs: taxi and delivery need a vehicle, the pilot needs a licence', () => {
  const s = L.create({ name: 'A', seed: 3 }); s.age = 22; s.knowledge = 90; s.flags.degree = 'be';
  const ev = (job) => { const t = L.JOBS[job]; return t; };
  assert.ok(L.JOBS.taxi && L.JOBS.delivery);
  s.pending = null; s.age = 21; L.advance(s);
  while (s.pending && s.pending.id !== 'job') { L.choose(s, s.pending.choices.find((c) => !c.locked).id); if (!s.pending) L.advance(s); }
  assert.strictEqual(s.pending.id, 'job');
  const locked = (id) => s.pending.choices.find((c) => c.id === id).locked;
  assert.strictEqual(locked('taxi'), true); assert.strictEqual(locked('delivery'), true); assert.strictEqual(locked('pilot'), true, 'no licence');
  s.items = ['bike']; s.flags.licence = true; s.pending = null; s.age = 21; L.advance(s);
  while (s.pending && s.pending.id !== 'job') { L.choose(s, s.pending.choices.find((c) => !c.locked).id); if (!s.pending) L.advance(s); }
  assert.strictEqual(s.pending.choices.find((c) => c.id === 'delivery').locked, false);
  assert.strictEqual(s.pending.choices.find((c) => c.id === 'taxi').locked, true, 'a bike is not a car');
  assert.strictEqual(s.pending.choices.find((c) => c.id === 'pilot').locked, false);
});

test('licence exam event gives the licence only for a good score', () => {
  const mk = () => { const s = L.create({ name: 'A', seed: 3 }); s.knowledge = 60; s.age = 19; s.pending = null; L.advance(s); while (s.pending && s.pending.id !== 'licence') { L.choose(s, s.pending.choices.find((c) => !c.locked).id); if (!s.pending) L.advance(s); } return s; };
  const pass = mk(); assert.strictEqual(pass.pending.id, 'licence'); L.choose(pass, 'exam', { score: 0.9 }); assert.strictEqual(pass.flags.licence, true);
  const fail = mk(); L.choose(fail, 'exam', { score: 0.2 }); assert.strictEqual(fail.flags.licence, undefined);
});

test('job mini-games: drive and route', () => {
  const o = G.makeDrive(5); assert.ok(o.length >= 6); o.forEach((x) => assert.ok(x.lane >= 0 && x.lane <= 2 && x.t < G.DRIVE_SECS));
  assert.deepStrictEqual(G.makeDrive(5), o);
  assert.strictEqual(G.scoreDrive([], []), 1);
  const dodge = o.map((x) => ({ t: x.t, lane: (x.lane + 1) % 3 })).concat([]);
  assert.ok(G.scoreDrive(o, []) <= 1);
  assert.strictEqual(G.scoreDrive([{ t: 1, lane: 1 }], []), 0.8, 'standing in lane 1 gets hit');
  assert.strictEqual(G.scoreDrive([{ t: 1, lane: 0 }], []), 1);
  assert.strictEqual(G.laneAt([{ t: 1, lane: 0 }, { t: 2, lane: 2 }], 1.5), 0);
  for (let seed = 1; seed < 40; seed++) {
    const { depot, stops } = G.makeRoute(seed); assert.strictEqual(new Set([depot, ...stops].map(String)).size, 5);
    const best = G.bestRoute(depot, stops);
    const perms = [[0, 1, 2, 3], [3, 2, 1, 0], [1, 3, 0, 2]];
    perms.forEach((p) => { assert.ok(G.routeLen(depot, stops, p) >= best); const sc = G.scoreRoute(depot, stops, p); assert.ok(sc > 0 && sc <= 1); });
    assert.strictEqual(G.scoreRoute(depot, stops, [0, 1]), 0, 'incomplete route');
    assert.strictEqual(G.scoreRoute(depot, stops, [0, 0, 1, 2]), 0, 'a stop twice');
  }
});
