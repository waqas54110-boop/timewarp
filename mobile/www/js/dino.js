// TimeWarp Dinosaur Era: a small prehistoric map (16 x 11 tiles). Dig up fossils, hide in bushes from the big dinosaurs, bring the egg
// from the nest to your camp, hatch it with 3 fossils and raise a pet dino by feeding it crops from the Time Farm.
// Nobody is hurt: if a big dino reaches you, it scares you back to camp (and the egg goes back to its nest).
//   T tree   ~ water   b bush (hide)   . grass   C camp (safe)   f buried fossil   E nest
// Pure logic (no DOM, seeded random): tests/adventures.test.js. The screen is public/js/dino-ui.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpDino = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MAP = [
    'TTTTTTTTTTTTTTTT',
    'T..f...b....f..T',
    'T.TT..~~..b.TT.T',
    'T..b..~~...f...T',
    'T.f...~~..TT.b.T',
    'T..TT.....T...fT',
    'Tb.......b...T.T',
    'T..f.TT..~~..b.T',
    'T.C....b.~~.f..T',
    'Tb...f.......E.T',
    'TTTTTTTTTTTTTTTT',
  ];
  const W = MAP[0].length, H = MAP.length;
  const FOSSILS = [
    { id: 'shell', icon: '🐚', name: 'Seep ka nishan', value: 10 }, { id: 'bone', icon: '🦴', name: 'Hadi', value: 15 },
    { id: 'footprint', icon: '🐾', name: 'Qadmon ka nishan', value: 20 }, { id: 'tooth', icon: '🦷', name: 'Dant', value: 25 },
  ];
  const FOSSIL_IDS = FOSSILS.map((f) => f.id);
  const KINDS = [{ id: 'draco', icon: '🐲', name: 'Draco' }, { id: 'gecko', icon: '🦎', name: 'Gecko-saurus' }, { id: 'croc', icon: '🐊', name: 'Crocky' }];
  const KIND_BY = {}; KINDS.forEach((k) => { KIND_BY[k.id] = k; });
  const LEVEL_XP = [0, 20, 60, 130];   // xp needed for level 1..4
  const HATCH_COST = 3, TRIP_BONUS = 50;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rng = (run) => { run.rs = (run.rs + 0x6D2B79F5) | 0; let t = Math.imul(run.rs ^ (run.rs >>> 15), 1 | run.rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const at = (x, y) => (y >= 0 && y < H && x >= 0 && x < W ? MAP[y][x] : 'T');
  const blocked = (x, y) => { const c = at(x, y); return c === 'T' || c === '~'; };
  const find = (ch) => { const out = []; MAP.forEach((row, y) => { for (let x = 0; x < W; x++) if (row[x] === ch) out.push({ x, y }); }); return out; };
  const CAMP = find('C')[0], NEST = find('E')[0];

  function init(adv) { if (!adv.dino) adv.dino = { egg: 'nest', pet: null, trips: 0, scares: 0, dug: 0 }; return adv.dino; }
  function sanitize(raw) {
    const d = { egg: 'nest', pet: null, trips: 0, scares: 0, dug: 0 };
    if (!raw || typeof raw !== 'object') return d;
    const n = (v, max) => (Number.isFinite(+v) && v !== null && v !== '' ? clamp(Math.round(+v), 0, max) : 0);
    d.egg = ['nest', 'camp', 'hatched'].includes(raw.egg) ? raw.egg : 'nest';
    d.trips = n(raw.trips, 99999); d.scares = n(raw.scares, 99999); d.dug = n(raw.dug, 999999);
    if (raw.pet && KIND_BY[raw.pet.kind]) d.pet = { name: String(raw.pet.name || KIND_BY[raw.pet.kind].name).replace(/[<>&"'`]/g, '').trim().slice(0, 16) || KIND_BY[raw.pet.kind].name, kind: raw.pet.kind, xp: n(raw.pet.xp, 9999) };
    if (d.pet) d.egg = 'hatched';
    else if (d.egg === 'hatched') d.egg = 'camp';
    return d;
  }
  const petLevel = (pet) => (pet ? LEVEL_XP.filter((x) => pet.xp >= x).length : 0);

  // a fresh run: fossils buried again, dinosaurs back at home, player at camp
  function newRun(adv, seed) {
    const run = {
      rs: (seed == null ? Math.floor(Math.random() * 2147483647) : seed) | 0, x: CAMP.x, y: CAMP.y, prev: { x: CAMP.x, y: CAMP.y }, pcd: 0, t: 0, carry: false,
      fos: find('f').map((p) => ({ x: p.x, y: p.y, dug: false })), egg: adv.dino.egg === 'nest' ? { x: NEST.x, y: NEST.y } : null,
      dinos: [
        { kind: 'rex', x: 11, y: 9, hx: 11, hy: 9, cd: 0.6, mode: 'patrol', sulk: 0 },
        { kind: 'rex', x: 9, y: 3, hx: 9, hy: 3, cd: 1, mode: 'patrol', sulk: 0 },
        { kind: 'herb', x: 3, y: 6, hx: 3, hy: 6, cd: 0.5, mode: 'patrol', sulk: 0 },
        { kind: 'herb', x: 13, y: 3, hx: 13, hy: 3, cd: 0.8, mode: 'patrol', sulk: 0 },
        { kind: 'herb', x: 8, y: 7, hx: 8, hy: 7, cd: 1.1, mode: 'patrol', sulk: 0 },
      ],
      scared: 0, say: '',
    };
    return run;
  }
  const dinoAt = (run, x, y, skip) => run.dinos.find((d) => d !== skip && d.x === x && d.y === y);

  function caught(run, adv) {
    run.x = CAMP.x; run.y = CAMP.y; run.prev = { x: CAMP.x, y: CAMP.y };
    if (run.carry) { run.carry = false; run.egg = { x: NEST.x, y: NEST.y }; }
    run.scared += 1; adv.dino.scares = Math.min(99999, adv.dino.scares + 1);
    run.dinos.forEach((d) => { if (d.kind === 'rex' && Math.abs(d.x - run.x) + Math.abs(d.y - run.y) < 4) { d.sulk = 3; d.mode = 'patrol'; } });
    return { type: 'caught', say: '🦖 Bade dino ne daraa kar door bhaga diya! Aap camp mein wapas aa gaye.' };
  }
  // one step of the player (dx, dy in -1..1). Returns {moved, events}
  function move(run, adv, dx, dy) {
    const ev = [];
    if (run.pcd > 0 || (!dx && !dy)) return { moved: false, events: ev };
    const nx = run.x + Math.sign(dx), ny = run.y + (dx ? 0 : Math.sign(dy));
    if (blocked(nx, ny)) return { moved: false, events: ev };
    const d = dinoAt(run, nx, ny);
    if (d && d.kind === 'herb') return { moved: false, events: ev };     // a peaceful dino blocks the way
    run.prev = { x: run.x, y: run.y }; run.x = nx; run.y = ny; run.pcd = 0.14;
    if (d && d.kind === 'rex') { ev.push(caught(run, adv)); return { moved: true, events: ev }; }
    if (at(nx, ny) === 'C' && run.carry) { run.carry = false; adv.dino.egg = 'camp'; ev.push({ type: 'egg-home', say: '🥚 Anda camp mein pahunch gaya! Ab 3 fossils se use garam kar ke nikalo.' }); }
    return { moved: true, events: ev };
  }
  const fossilReach = (adv) => { const l = petLevel(adv.dino.pet); return l >= 3 ? 99 : l === 2 ? 4 : 2; };
  // fossils close enough to show a dust puff (the pet's nose reaches further as it grows)
  function hints(run, adv) { const r = fossilReach(adv); return run.fos.filter((f) => !f.dug && Math.abs(f.x - run.x) + Math.abs(f.y - run.y) <= r); }

  // E / the Dig button: dig a fossil you stand on, or pick up the egg at the nest
  function act(run, adv) {
    const f = run.fos.find((q) => !q.dug && q.x === run.x && q.y === run.y);
    if (f) {
      f.dug = true; const kind = FOSSILS[Math.floor(rng(run) * FOSSILS.length)];
      adv.wallet.fossils[kind.id] = Math.min(9999, (adv.wallet.fossils[kind.id] || 0) + 1); adv.wallet.coins = Math.min(99999999, adv.wallet.coins + kind.value); adv.dino.dug = Math.min(999999, adv.dino.dug + 1);
      const res = { ok: true, say: kind.icon + ' ' + kind.name + ' mila! +Rs ' + kind.value };
      if (run.fos.every((q) => q.dug)) { adv.dino.trips += 1; adv.wallet.coins = Math.min(99999999, adv.wallet.coins + TRIP_BONUS); res.tripDone = true; res.say += ' Saare fossils mil gaye, bonus Rs ' + TRIP_BONUS + '!'; }
      return res;
    }
    if (run.egg && run.x === run.egg.x && run.y === run.egg.y) {
      if (run.carry) return { ok: false, why: 'Anda pehle hi aap ke paas hai' };
      run.carry = true; run.egg = null; return { ok: true, say: '🥚 Anda utha liya! Rex se bach kar camp tak pahunchein.' };
    }
    return { ok: false, why: 'Yahan khodne ko kuch nahi' };
  }
  const fossilCount = (adv) => Object.values(adv.wallet.fossils).reduce((a, b) => a + b, 0);
  // at camp: warm the egg with 3 fossils and the baby dino hatches (kind chosen by the seeded random)
  function hatch(run, adv) {
    if (adv.dino.egg !== 'camp') return { ok: false, why: adv.dino.egg === 'hatched' ? 'Anda pehle hi nikal chuka hai' : 'Pehle nest se anda camp tak laayen' };
    if (fossilCount(adv) < HATCH_COST) return { ok: false, why: 'Anda garam karne ke liye ' + HATCH_COST + ' fossils chahiye' };
    let need = HATCH_COST;
    FOSSIL_IDS.forEach((id) => { while (need > 0 && (adv.wallet.fossils[id] || 0) > 0) { adv.wallet.fossils[id] -= 1; need -= 1; if (!adv.wallet.fossils[id]) delete adv.wallet.fossils[id]; } });
    const kind = KINDS[Math.floor(rng(run) * KINDS.length)];
    adv.dino.pet = { name: kind.name, kind: kind.id, xp: 0 }; adv.dino.egg = 'hatched';
    return { ok: true, say: '🐣 Anda phat gaya! ' + kind.icon + ' ' + kind.name + ' ab aap ka pet dino hai.' };
  }
  function rename(adv, name) {
    if (!adv.dino.pet) return { ok: false, why: 'Abhi koi pet dino nahi' };
    const n = String(name || '').replace(/[<>&"'`]/g, '').trim().slice(0, 16);
    if (!n) return { ok: false, why: 'Naam khali nahi ho sakta' };
    adv.dino.pet.name = n; return { ok: true, say: 'Naam rakh diya: ' + n };
  }
  // feed the pet one crop from the Time Farm basket: the dearer the crop, the more it grows
  function feed(adv, cropId, cropSell) {
    const pet = adv.dino.pet;
    if (!pet) return { ok: false, why: 'Pehle anda hatch karein' };
    if (!(adv.wallet.basket[cropId] > 0)) return { ok: false, why: 'Tokri mein ye fasal nahi hai (Time Farm se ugayein)' };
    adv.wallet.basket[cropId] -= 1; if (!adv.wallet.basket[cropId]) delete adv.wallet.basket[cropId];
    const before = petLevel(pet); pet.xp = Math.min(9999, pet.xp + Math.max(3, Math.round((cropSell || 40) / 15)));
    const after = petLevel(pet);
    return { ok: true, level: after, levelUp: after > before, say: (KIND_BY[pet.kind].icon) + ' ' + pet.name + ' ne maze se khaya!' + (after > before ? ' ⭐ Level ' + after + '!' : '') };
  }

  // dinosaurs move on their own clocks. dt in seconds. Returns events (e.g. caught).
  function tick(run, adv, dt) {
    const ev = [];
    run.t += dt; run.pcd = Math.max(0, run.pcd - dt);
    const lvl = petLevel(adv.dino.pet), range = lvl >= 4 ? 3 : 5;
    const hiding = at(run.x, run.y) === 'b', safe = at(run.x, run.y) === 'C';
    for (const d of run.dinos) {
      d.sulk = Math.max(0, d.sulk - dt); d.cd -= dt;
      if (d.cd > 0) continue;
      const dist = Math.abs(d.x - run.x) + Math.abs(d.y - run.y);
      if (d.kind === 'rex') d.mode = !safe && d.sulk <= 0 && dist <= range && !(hiding && dist > 1) ? 'chase' : 'patrol';
      let tx = 0, ty = 0;
      if (d.mode === 'chase') {
        const dx = run.x - d.x, dy = run.y - d.y;
        const order = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
        for (const [sx, sy] of order) { if (!sx && !sy) continue; if (!blocked(d.x + sx, d.y + sy) && at(d.x + sx, d.y + sy) !== 'C' && !dinoAt(run, d.x + sx, d.y + sy, d)) { tx = sx; ty = sy; break; } }
        d.cd = 0.42;
      } else {
        const far = Math.abs(d.x - d.hx) + Math.abs(d.y - d.hy) > 4;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let pick = dirs[Math.floor(rng(run) * 4)];
        if (far) pick = Math.abs(d.hx - d.x) >= Math.abs(d.hy - d.y) ? [Math.sign(d.hx - d.x), 0] : [0, Math.sign(d.hy - d.y)];
        if (rng(run) > 0.7) pick = [0, 0];
        [tx, ty] = pick;
        d.cd = d.kind === 'rex' ? 0.7 : 0.95;
      }
      if (!tx && !ty) continue;
      const nx = d.x + tx, ny = d.y + ty;
      if (blocked(nx, ny) || at(nx, ny) === 'C' || dinoAt(run, nx, ny, d)) continue;
      if (nx === run.x && ny === run.y) {
        if (d.kind === 'rex' && !safe) { ev.push(caught(run, adv)); }
        continue;       // a herbivore never walks onto you; a rex cannot enter camp
      }
      d.x = nx; d.y = ny;
    }
    return ev;
  }
  return { MAP, W, H, FOSSILS, FOSSIL_IDS, KINDS, KIND_BY, LEVEL_XP, HATCH_COST, TRIP_BONUS, CAMP, NEST, init, sanitize, petLevel, newRun, move, act, hatch, rename, feed, tick, hints, fossilCount, at, blocked };
});
