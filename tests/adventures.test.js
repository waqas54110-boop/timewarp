const test = require('node:test');
const assert = require('node:assert');
const Adv = require('../public/js/adv.js');
const Farm = require('../public/js/farm.js');
const Det = require('../public/js/detective.js');
const Dino = require('../public/js/dino.js');

const mods = { Farm, Detective: Det, Dino };
const game = () => Adv.sanitize(null, mods);

// ---------- shared state ----------
test('adv: a fresh game has all three parts; garbage and tampered saves are cleaned up', () => {
  const a = game();
  assert.ok(a.farm && a.det && a.dino);
  assert.strictEqual(a.wallet.coins, 150);
  const bad = Adv.sanitize({ wallet: { coins: -5, basket: { gandum: 9, hacked: 99, tamatar: 'x' }, fossils: { bone: 3, nope: 1 } }, farm: { era: 'mars', plots: [{ crop: 'nope' }] }, det: { stars: { 'past-1': 9, 'x-1': 2, 'future-2': 2 } }, dino: { egg: 'hatched', pet: null } }, mods);
  assert.strictEqual(bad.wallet.coins, 0);
  assert.deepStrictEqual(bad.wallet.basket, { gandum: 9 });
  assert.deepStrictEqual(bad.wallet.fossils, { bone: 3 });
  assert.strictEqual(bad.farm.era, 'present');
  assert.strictEqual(bad.farm.plots[0], null);
  assert.deepStrictEqual(bad.det.stars, { 'future-2': 2 });
  assert.strictEqual(bad.dino.egg, 'camp', 'hatched without a pet falls back to camp');
  assert.ok(Adv.sanitize('junk', mods).farm);
});
test('adv: save and load through a storage object; broken storage never throws', () => {
  const mem = {}; const st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const a = game(); a.wallet.coins = 777; assert.ok(Adv.save(st, a));
  assert.strictEqual(Adv.load(st, mods).wallet.coins, 777);
  assert.ok(Adv.load({ getItem: () => '{oops', setItem() {} }, mods).farm);
  assert.strictEqual(Adv.save({ setItem() { throw new Error('full'); } }, a), false);
});

// ---------- Time Farm ----------
test('farm: seeds are sold only in their own era; time fruit in every era', () => {
  const a = game();
  assert.strictEqual(Farm.plant(a, 0, 'gandum').ok, false);          // present era: no wheat seed
  assert.ok(Farm.plant(a, 0, 'tamatar').ok);
  assert.strictEqual(a.wallet.coins, 125);
  assert.strictEqual(Farm.plant(a, 0, 'makai').ok, false, 'plot is taken');
  a.farm.era = 'future'; a.wallet.coins = 500; assert.ok(Farm.plant(a, 1, 'timefruit').ok);
  assert.strictEqual(Farm.plant(a, 99, 'salad').ok, false);
});
test('farm: wheat planted in the past is harvested in the future; the trip makes it ripe', () => {
  const a = game(); a.farm.era = 'past';
  Farm.plant(a, 0, 'gandum'); assert.strictEqual(Farm.status(a.farm, 0), 'growing');
  assert.strictEqual(Farm.harvest(a, 0).ok, false, 'too early');
  const t = Farm.travel(a, 'future'); assert.strictEqual(t.steps, 2); assert.strictEqual(t.ripe, 1);
  const h = Farm.harvest(a, 0); assert.ok(h.ok); assert.strictEqual(h.qty, 2); assert.strictEqual(a.wallet.basket.gandum, 2);
  assert.strictEqual(a.farm.plots[0], null);
});
test('farm: days make a crop ripe in the same era; each crop only survives so many era steps', () => {
  const a = game(); Farm.plant(a, 0, 'tamatar');
  for (let i = 0; i < 3; i++) Farm.nextDay(a);
  assert.strictEqual(Farm.status(a.farm, 0), 'ripe');
  a.farm.era = 'future'; Farm.plant(a, 1, 'salad');   // hydroponic salad rots on any trip
  Farm.travel(a, 'present'); assert.strictEqual(Farm.status(a.farm, 1), 'rotten');
  const h = Farm.harvest(a, 1); assert.ok(h.rotten); assert.strictEqual(a.wallet.basket.salad, undefined);
  a.farm.era = 'present'; Farm.plant(a, 2, 'tamatar'); Farm.travel(a, 'past'); Farm.travel(a, 'future');   // 1 + 2 = 3 steps > keeps 2
  assert.strictEqual(Farm.status(a.farm, 2), 'rotten');
});
test('farm: time fruit needs 2 era steps; watering in each era adds fruit once per era', () => {
  const a = game(); a.wallet.coins = 1000; a.farm.era = 'past';
  Farm.plant(a, 0, 'timefruit'); Farm.travel(a, 'present'); assert.strictEqual(Farm.status(a.farm, 0), 'growing');
  assert.ok(Farm.water(a, 0).ok); assert.strictEqual(Farm.water(a, 0).ok, false, 'once per era');
  Farm.travel(a, 'future'); assert.strictEqual(Farm.status(a.farm, 0), 'ripe');
  assert.ok(Farm.water(a, 0).ok);
  const h = Farm.harvest(a, 0); assert.strictEqual(h.qty, 4);        // 2 + watered in present and future
  assert.strictEqual(a.farm.timefruits, 4);
});
test('farm: rain in the past waters the plots; selling uses the era market and the rare-crop bonus', () => {
  const a = game(); a.farm.era = 'past'; Farm.plant(a, 0, 'sarson');
  Farm.nextDay(a); Farm.nextDay(a); const r = Farm.nextDay(a); assert.ok(r.rained); assert.deepStrictEqual(a.farm.plots[0].wat, ['past']);
  assert.strictEqual(Farm.unitPrice('gandum', 'past'), 44);          // 55 * 0.8
  assert.strictEqual(Farm.unitPrice('gandum', 'future'), 103);       // 55 * 1.5 * 1.25 = 103.1
  a.wallet.basket.gandum = 4; a.farm.era = 'future';
  const before = a.wallet.coins, s = Farm.sell(a, 'gandum', 'all');
  assert.strictEqual(s.total, 412); assert.strictEqual(a.wallet.coins, before + 412); assert.strictEqual(a.wallet.basket.gandum, undefined);
  assert.strictEqual(Farm.sell(a, 'gandum', 1).ok, false);
});
test('farm: extra plots cost money and stop at the maximum', () => {
  const a = game(); a.wallet.coins = 5000;
  for (let i = Farm.START_PLOTS; i < Farm.MAX_PLOTS; i++) assert.ok(Farm.buyPlot(a).ok);
  assert.strictEqual(Farm.buyPlot(a).ok, false); assert.strictEqual(a.farm.plots.length, Farm.MAX_PLOTS);
  assert.strictEqual(Adv.sanitize(JSON.parse(JSON.stringify(a)), mods).farm.plots.length, Farm.MAX_PLOTS);
  const poor = game(); poor.wallet.coins = 10; assert.strictEqual(Farm.buyPlot(poor).ok, false);
});

// ---------- Time Detective ----------
test('detective: every case id builds, is repeatable and always has a single answer', () => {
  Det.ERAS.forEach((era) => { for (let seed = 1; seed <= 120; seed++) {
    const c = Det.makeCase(era, seed), c2 = Det.makeCase(era, seed);
    assert.deepStrictEqual(c, c2); assert.strictEqual(c.items.length, 8);
    assert.strictEqual(new Set(c.items.map((i) => i.icon)).size, 8, 'no two things look the same: ' + c.id);
    const g = c.items.find((i) => i.id === c.glitch);
    const all = c.items.filter((i) => Det.ATTRS.every((k) => i.attrs[k] === g.attrs[k]));
    assert.strictEqual(all.length, 1, 'the four answers name one item: ' + c.id);
    const uniq = Det.ATTRS.filter((k) => c.items.filter((i) => i.attrs[k] === g.attrs[k]).length === 1);
    assert.ok(uniq.length <= 1, 'at most one answer alone names it: ' + c.id);
    assert.notStrictEqual(c.rumour, c.glitch);
  } });
  assert.strictEqual(Det.CASE_IDS.length, 9); Det.CASE_IDS.forEach((id) => assert.ok(Det.getCase(id)));
  assert.strictEqual(Det.getCase('mars-1'), null);
  assert.strictEqual(Det.dailyCase(20500).id, Det.dailyCase(20500).id);
});
test('detective: questions narrow down the suspects and the answers are true', () => {
  const a = game(), c = Det.getCase('present-1'), s = Det.newSession(c), g = c.items.find((i) => i.id === c.glitch);
  assert.strictEqual(Det.candidates(c, s).length, 8);
  Det.ATTRS.forEach((q) => { const r = Det.ask(c, s, q); assert.ok(r.ok); assert.ok(r.text.includes(g.attrs[q]) || r.text.includes('khamosh')); assert.strictEqual(Det.ask(c, s, q).ok, false, 'same question twice'); });
  assert.deepStrictEqual(Det.candidates(c, s), [c.glitch]);
  assert.strictEqual(Det.ask(c, s, 'taste').ok, false);
  const t = Det.newSession(c), r = Det.ask(c, t, 'rumour'); assert.ok(r.rumour); assert.strictEqual(Det.candidates(c, t).length, 8, 'a rumour proves nothing');
  assert.strictEqual(Det.ask(c, t, 'rumour').ok, false);
});
test('detective: stars depend on the questions and wrong guesses; coins are paid once per extra star', () => {
  const a = game(), c = Det.getCase('past-2');
  let s = Det.newSession(c); Det.ask(c, s, 'color'); Det.ask(c, s, 'place');
  const wrongId = c.items.find((i) => i.id !== c.glitch).id;
  assert.strictEqual(Det.accuse(a, c, s, wrongId).right, false); assert.strictEqual(s.wrong, 1);
  const win = Det.accuse(a, c, s, c.glitch); assert.ok(win.right); assert.strictEqual(win.stars, 2, '3 stars - 1 wrong guess'); assert.strictEqual(win.coins, 80);
  assert.strictEqual(a.det.stars['past-2'], 2); assert.strictEqual(Det.accuse(a, c, s, c.glitch).ok, false, 'case is over');
  s = Det.newSession(c); Det.ask(c, s, 'color'); const again = Det.accuse(a, c, s, c.glitch);
  assert.strictEqual(again.stars, 3); assert.strictEqual(again.coins, 40, 'only the extra star pays'); assert.strictEqual(a.wallet.coins, 150 + 80 + 40);
  s = Det.newSession(c); Det.ask(c, s, 'color'); Det.accuse(a, c, s, c.glitch).coins; assert.strictEqual(a.wallet.coins, 270, 'no stars gained = no coins');
  s = Det.newSession(c); ['color', 'sound', 'place', 'power'].forEach((q) => Det.ask(c, s, q)); assert.strictEqual(Det.starsFor(s), 1);
});
test('detective: three wrong guesses end the case; rank follows the total stars', () => {
  const a = game(), c = Det.getCase('future-1'), s = Det.newSession(c);
  const wrong = c.items.filter((i) => i.id !== c.glitch);
  Det.accuse(a, c, s, wrong[0].id); Det.accuse(a, c, s, wrong[1].id); const last = Det.accuse(a, c, s, wrong[2].id);
  assert.ok(last.over && !last.right); assert.strictEqual(Det.accuse(a, c, s, c.glitch).ok, false);
  assert.strictEqual(Det.accuse(a, c, Det.newSession(c), 'zzz').ok, false);
  assert.ok(Det.rank(a).startsWith('Naya')); Det.CASE_IDS.forEach((id) => { a.det.stars[id] = 3; });
  assert.ok(Det.rank(a).includes('Sherlock')); assert.strictEqual(Det.totalStars(a), 27);
});

// ---------- Dinosaur Era ----------
test('dino: the map is rectangular, has a camp, a nest and 8 fossils', () => {
  assert.ok(Dino.MAP.every((r) => r.length === Dino.W)); assert.strictEqual(Dino.MAP.length, Dino.H);
  assert.strictEqual(Dino.at(Dino.CAMP.x, Dino.CAMP.y), 'C'); assert.strictEqual(Dino.at(Dino.NEST.x, Dino.NEST.y), 'E');
  const a = game(), r = Dino.newRun(a, 1); assert.strictEqual(r.fos.length, 8); assert.ok(r.egg);
  r.dinos.forEach((d) => assert.ok(!Dino.blocked(d.x, d.y)));
});
test('dino: walls stop you, a herbivore blocks the way but never hurts', () => {
  const a = game(), r = Dino.newRun(a, 1);
  r.x = 1; r.y = 1; assert.strictEqual(Dino.move(r, a, -1, 0).moved, false);       // tree border
  r.dinos.forEach((d) => { d.x = 20; d.y = 20; });
  const h = r.dinos.find((d) => d.kind === 'herb'); h.x = 2; h.y = 1; r.pcd = 0;
  assert.strictEqual(Dino.move(r, a, 1, 0).moved, false);
  assert.strictEqual(r.scared, 0);
});
test('dino: digging gives a fossil and coins once; digging every fossil ends the trip with a bonus', () => {
  const a = game(), r = Dino.newRun(a, 9);
  assert.strictEqual(Dino.act(r, a).ok, false, 'nothing buried at camp');
  let last;
  r.fos.forEach((f) => { r.x = f.x; r.y = f.y; last = Dino.act(r, a); assert.ok(last.ok); assert.strictEqual(Dino.act(r, a).ok, false, 'already dug'); });
  assert.ok(last.tripDone); assert.strictEqual(a.dino.trips, 1); assert.strictEqual(Dino.fossilCount(a), 8); assert.ok(a.wallet.coins >= 150 + 8 * 10 + Dino.TRIP_BONUS);
});
test('dino: a big dino scares you to camp, the egg goes back to the nest; bushes hide you; the camp is safe', () => {
  const a = game(), r = Dino.newRun(a, 3);
  r.dinos.forEach((d) => { d.x = 15; d.y = 0; d.cd = 99; }); const rex = r.dinos[0];
  r.x = Dino.NEST.x; r.y = Dino.NEST.y; assert.ok(Dino.act(r, a).ok); assert.ok(r.carry); assert.strictEqual(r.egg, null);
  rex.x = Dino.NEST.x - 1; rex.y = Dino.NEST.y; rex.cd = 0; rex.mode = 'chase';
  const ev = Dino.tick(r, a, 0.01); assert.strictEqual(ev[0].type, 'caught');
  assert.deepStrictEqual([r.x, r.y], [Dino.CAMP.x, Dino.CAMP.y]); assert.strictEqual(r.carry, false); assert.deepStrictEqual(r.egg, Dino.NEST); assert.strictEqual(a.dino.scares, 1);
  // hiding: a rex 3 tiles away does not chase a player in a bush
  rex.x = 5; rex.y = 4; rex.sulk = 0; rex.cd = 0; r.x = 3; r.y = 3; assert.strictEqual(Dino.at(3, 3), 'b');
  Dino.tick(r, a, 0.01); assert.strictEqual(rex.mode, 'patrol');
  r.x = 4; r.y = 6; rex.x = 4; rex.y = 4; rex.cd = 0; rex.sulk = 0; Dino.tick(r, a, 0.01); assert.strictEqual(rex.mode, 'chase', 'in the open it chases');
  // camp is safe
  r.x = Dino.CAMP.x; r.y = Dino.CAMP.y; rex.x = r.x + 2; rex.y = r.y; rex.cd = 0; rex.sulk = 0; Dino.tick(r, a, 0.01); assert.strictEqual(rex.mode, 'patrol');
});
test('dino: random walk for a long time never puts a dinosaur on a wall, in camp or on top of another dino', () => {
  const a = game(), r = Dino.newRun(a, 11); r.x = Dino.CAMP.x; r.y = Dino.CAMP.y;
  for (let i = 0; i < 4000; i++) {
    Dino.tick(r, a, 0.1);
    const seen = new Set();
    r.dinos.forEach((d) => { assert.ok(!Dino.blocked(d.x, d.y)); assert.notStrictEqual(Dino.at(d.x, d.y), 'C'); const k = d.x + ',' + d.y; assert.ok(!seen.has(k), 'two dinos on one tile'); seen.add(k); });
  }
  assert.strictEqual(a.dino.scares, 0, 'a player resting in camp is never scared');
});
test('dino: carrying the egg to camp, hatching with 3 fossils, naming and feeding the pet', () => {
  const a = game(), r = Dino.newRun(a, 4);
  r.dinos.forEach((d) => { d.x = 15; d.y = 0; d.cd = 99; });
  r.x = Dino.NEST.x; r.y = Dino.NEST.y; Dino.act(r, a);
  assert.strictEqual(Dino.hatch(r, a).ok, false, 'egg is not at camp yet');
  r.x = Dino.CAMP.x + 1; r.y = Dino.CAMP.y; r.pcd = 0; const m = Dino.move(r, a, -1, 0); assert.strictEqual(m.events[0].type, 'egg-home'); assert.strictEqual(a.dino.egg, 'camp');
  assert.strictEqual(Dino.hatch(r, a).ok, false, 'needs fossils');
  a.wallet.fossils = { bone: 2, tooth: 2 }; const h = Dino.hatch(r, a); assert.ok(h.ok);
  assert.strictEqual(Dino.fossilCount(a), 1); assert.ok(a.dino.pet); assert.strictEqual(a.dino.egg, 'hatched'); assert.strictEqual(Dino.petLevel(a.dino.pet), 1);
  assert.strictEqual(Dino.hatch(r, a).ok, false); assert.strictEqual(Dino.newRun(a, 1).egg, null, 'no second egg in the nest');
  assert.ok(Dino.rename(a, 'Raja <b>').ok); assert.strictEqual(a.dino.pet.name, 'Raja b'); assert.strictEqual(Dino.rename(a, '   ').ok, false);
  assert.strictEqual(Dino.feed(a, 'aam', 200).ok, false, 'basket is empty');
  a.wallet.basket = { aam: 3 }; const f = Dino.feed(a, 'aam', 200); assert.ok(f.ok); assert.strictEqual(a.dino.pet.xp, 13); assert.strictEqual(a.wallet.basket.aam, 2);
  Dino.feed(a, 'aam', 200); assert.strictEqual(Dino.petLevel(a.dino.pet), 2, '26 xp = level 2');
});
test('dino: a bigger pet smells fossils from further away; a level 4 pet makes rex lose interest sooner', () => {
  const a = game(), r = Dino.newRun(a, 6); r.x = Dino.CAMP.x; r.y = Dino.CAMP.y;
  const none = Dino.hints(r, a).length;
  a.dino.pet = { name: 'P', kind: 'draco', xp: 20 }; const l2 = Dino.hints(r, a).length;
  a.dino.pet.xp = 60; const l3 = Dino.hints(r, a).length;
  assert.ok(none <= l2 && l2 <= l3); assert.strictEqual(l3, 8);
  a.dino.pet.xp = 130; r.dinos.forEach((d) => { d.cd = 99; }); const rex = r.dinos[0]; rex.x = 8; rex.y = 6; rex.cd = 0; rex.sulk = 0; r.x = 5; r.y = 6;   // distance 3 -> chases at level 4 only if <= 3
  Dino.tick(r, a, 0.01); assert.strictEqual(rex.mode, 'chase');
  rex.x = 10; rex.y = 6; rex.cd = 0; Dino.tick(r, a, 0.01); assert.strictEqual(rex.mode, 'patrol', 'distance 5 is outside the level-4 range');
});
test('dino: saved game is clean: no pet means the egg cannot be hatched; names are cleaned; xp is clamped', () => {
  const d = Dino.sanitize({ egg: 'hatched', pet: { name: '<script>', kind: 'draco', xp: 999999 }, trips: -3, scares: 'x' });
  assert.strictEqual(d.pet.name, 'script'); assert.strictEqual(d.pet.xp, 9999); assert.strictEqual(d.trips, 0); assert.strictEqual(d.scares, 0);
  assert.strictEqual(Dino.sanitize({ egg: 'hatched', pet: { kind: 'unknown' } }).pet, null);
});
