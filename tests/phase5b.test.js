const test = require('node:test');
const assert = require('node:assert');
const L = require('../public/js/life.js');
const M = require('../public/js/meta.js');
const F = require('../public/js/friends.js');
const I = require('../public/js/i18n.js');
const S = require('../public/js/save.js');
const { sanitize, present } = require('../services/saveService.js');
const { entry } = require('../services/lifeScoreService.js');

function finished(seed, opts) {
  const s = L.create(Object.assign({ name: 'Ali', era: 'present', seed }, opts));
  for (let g = 0; g < 5000 && !s.over; g++) { if (s.pending) L.choose(s, (s.pending.choices.find((c) => !c.locked && !c.game) || s.pending.choices.find((c) => !c.locked)).id); else L.advance(s); }
  return s;
}
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };

// ---------- Time Machine meta ----------
test('meta.sanitize drops unknown perks, clamps numbers and keeps language valid', () => {
  const m = M.sanitize({ points: 1e9, best: -4, lang: 'xx', perks: ['rich', 'rich', 'nope'] }, L.PERKS);
  assert.deepStrictEqual(m, { points: 100000, perks: ['rich'], best: 0, lang: 'rm', lives: 0 });
  assert.deepStrictEqual(M.sanitize('junk', L.PERKS), M.fresh());
});
test('points of a finished life are paid once; perks cost points and apply to the next life', () => {
  const s = finished(3), m = M.fresh();
  const r = M.claim(m, s, L); assert.ok(r.gained > 0); assert.strictEqual(M.claim(m, s, L).gained, 0);
  assert.strictEqual(m.lives, 1);
  assert.strictEqual(M.buy(m, 'scholar', L.PERKS).ok, false);
  m.points = 500; assert.ok(M.buy(m, 'scholar', L.PERKS).ok); assert.strictEqual(M.buy(m, 'scholar', L.PERKS).ok, false);
  const base = L.create({ name: 'A', seed: 1 }), up = L.create({ name: 'A', seed: 1, perks: m.perks });
  assert.strictEqual(up.knowledge, Math.min(100, base.knowledge + 10));
});
test('claiming points does not break leaderboard verification', () => {
  const s = finished(9); assert.ok(L.verify(s)); M.claim(M.fresh(), s, L); assert.ok(L.verify(L.restore(JSON.parse(JSON.stringify(s)))));
});

// ---------- leaderboard rules ----------
test('leaderboard accepts only finished, verifiable lives', () => {
  const s = finished(5), e = entry({ life: JSON.parse(JSON.stringify(s)) });
  assert.strictEqual(e.score, L.summary(s).score);
  const forged = JSON.parse(JSON.stringify(s)); forged.money = 9e9;
  assert.throws(() => entry({ life: forged }), /verified|valid/);
  const half = L.create({ name: 'A', seed: 2 }); assert.throws(() => entry({ life: half }), /finished/);
  assert.throws(() => entry({}), /valid/);
  const nohist = JSON.parse(JSON.stringify(s)); nohist.hist = []; assert.throws(() => entry({ life: nohist }));
});

// ---------- save service: meta part ----------
test('saveService accepts a meta-only save without touching the mode, and presents meta', () => {
  const out = sanitize({ meta: { points: 5, perks: ['joy', 'bad'], lang: 'en' } });
  assert.deepStrictEqual(out.meta.perks, ['joy']); assert.strictEqual(out.lastMode, undefined); assert.strictEqual(out.life, undefined);
  assert.throws(() => sanitize({}), /Nothing/);
  const p = present({ last_mode: 'life', life: null, year: null, position: null, meta: { points: 7, perks: [], lang: 'ur' }, saved_at: 'x' });
  assert.strictEqual(p.meta.points, 7); assert.strictEqual(present({ last_mode: 'life', year: null, saved_at: 'x' }).meta, null);
});

// ---------- browser save: meta, export/import, adopt ----------
test('guest save keeps meta next to life, and file export/import round-trips', async () => {
  const st = mem(), sv = S.create({ storage: st, fetchFn: null, csrf: '', auth: false });
  const life = finished(4); await sv.save('life', life); await sv.save('meta', M.fresh());
  const got = await sv.load(); assert.ok(got.life && got.meta);
  const back = sv.parseJson(sv.exportJson(got)); assert.deepStrictEqual(L.restore(back.life), L.restore(life));
  assert.strictEqual(sv.parseJson('{"x":1}'), null); assert.strictEqual(sv.parseJson('nonsense'), null);
  assert.throws(() => sv.save('bogus', {}));
});
test('adopt moves the browser save into the account but keeps parts the account already has', async () => {
  const st = mem(), calls = [];
  const guest = S.create({ storage: st, fetchFn: null, csrf: '', auth: false });
  await guest.save('life', finished(6)); await guest.save('meta', M.fresh());
  const fetchFn = async (u, o) => { calls.push(JSON.parse(o.body)); return { ok: true }; };
  const acc = S.create({ storage: st, fetchFn, csrf: 'c', auth: true });
  const moved = await acc.adopt({ life: { any: 1 } });
  assert.deepStrictEqual(moved, ['meta']); assert.ok(calls.length && calls[0].meta && !calls[0].life);
  assert.strictEqual(acc.local(), null);
});

// ---------- friends ----------
test('friendship grows with talk, gifts cost money, secrets need trust, repeated chat gains little', () => {
  const st = {}, rnd = () => 0.99, day = (n) => new Date(Date.UTC(2026, 0, n));
  const gift = F.talk(st, 'Ali|keeper', 'gift', rnd, { wallet: 500, day: day(1) }); assert.ok(gift.cost > 0 && gift.delta > 0);
  assert.strictEqual(F.talk(st, 'Ali|keeper', 'gift', rnd, { wallet: 0, day: day(1) }).cost, 0);
  const sec = F.talk(st, 'Q|k', 'secret', rnd, { wallet: 0, day: day(1) }); assert.strictEqual(sec.delta, 0);
  const a = F.talk(st, 'Z|x', 'salam', rnd, { wallet: 0, day: day(1) }), b = F.talk(st, 'Z|x', 'salam', rnd, { wallet: 0, day: day(1) });
  assert.ok(a.delta === 3 && b.delta === 1);
  for (let d = 2; d < 80; d++) { F.talk(st, 'Z|x', 'salam', rnd, { wallet: 0, day: day(d) }); F.talk(st, 'Z|x', 'praise', rnd, { wallet: 0, day: day(d) }); }
  const top = F.talk(st, 'Z|x', 'salam', rnd, { wallet: 0, day: day(200) });
  assert.strictEqual(top.pts, 100); assert.strictEqual(F.levelName(100), 'Jigri yaar');
});

// ---------- i18n ----------
test('every text exists in Urdu, Roman Urdu and English, and nothing is empty', () => {
  for (const [k, e] of Object.entries(I.D)) for (const l of Object.keys(I.LANGS)) assert.ok(e[l] && e[l].trim(), k + ' ' + l);
  assert.strictEqual(I.t('buy', 'en'), 'Buy'); assert.strictEqual(I.t('missing.key'), 'missing.key');
});
test('pages only use i18n keys that exist', () => {
  const fs = require('fs');
  for (const f of ['views/pages/life.ejs', 'views/pages/me.ejs']) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/data-i18n(?:-ph|-title)?="([^"]+)"/g)) assert.ok(I.D[m[1]], f + ': ' + m[1]);
  }
  const me = fs.readFileSync('public/js/me.js', 'utf8');
  for (const m of me.matchAll(/\bt\('([a-z.]+)'\)/g)) assert.ok(I.D[m[1]], 'me.js: ' + m[1]);
  for (const k of ['home', 'family', 'diary', 'dreams', 'capsule', 'butterfly', 'machine', 'board', 'settings']) assert.ok(I.D['tab.' + k], k);
});
