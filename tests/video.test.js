const test = require('node:test');
const assert = require('node:assert');
const V = require('../public/js/video.js');
const L = require('../public/js/life.js');

function finished(seed) {
  const s = L.create({ name: 'Ali', seed });
  while (!s.over) { if (s.pending) L.choose(s, s.pending.choices.find((c) => !c.locked).id); else L.advance(s); }
  return s;
}

test('letterbox gives a 2.39:1 picture and equal bars', () => {
  const lb = V.letterbox(1280, 720);
  assert.strictEqual(lb.bar * 2 + lb.inner, 720);
  assert.ok(Math.abs(1280 / lb.inner - V.RATIO) < 0.02);
  assert.strictEqual(V.letterbox(1280, 400).bar, 0, 'a picture already wider than 2.39:1 gets no bars');
});

test('wrap never cuts a word and respects the width', () => {
  const lines = V.wrap('Aap ne pehli baar chalna seekha aur poora ghar khushi se jhoom utha', 20);
  lines.forEach((l) => assert.ok(l.length <= 20, l));
  assert.strictEqual(lines.join(' '), 'Aap ne pehli baar chalna seekha aur poora ghar khushi se jhoom utha');
  assert.deepStrictEqual(V.wrap('', 10), []);
  assert.deepStrictEqual(V.wrap('supercalifragilistic', 5), ['supercalifragilistic']);
});

test('Life Movie plan: opens with a title, one episode card per stage, ends with the score; shots run back to back', () => {
  const life = finished(4), sum = L.summary(life), plan = V.planMovie(life, sum, L.STAGES, L.stageOf);
  const sh = plan.shots;
  assert.strictEqual(sh[0].kind, 'card'); assert.match(sh[0].title, /Ali ki Zindagi/);
  assert.strictEqual(sh[sh.length - 1].final, true); assert.match(sh[sh.length - 1].title, new RegExp('Life Score: ' + sum.score));
  for (let i = 1; i < sh.length; i++) assert.strictEqual(sh[i].t0, sh[i - 1].t1);
  assert.strictEqual(plan.duration, sh[sh.length - 1].t1);
  assert.strictEqual(sh.filter((x) => x.kind === 'scene').length, life.memories.length, 'every memory becomes a scene');
  const eps = sh.filter((x) => /^Episode/.test(x.title || ''));
  assert.ok(eps.length >= 5); eps.forEach((e, i) => assert.match(e.title, new RegExp('^Episode ' + (i + 1) + ':')));
  assert.ok(plan.duration < 260, 'film is under about four minutes: ' + plan.duration);
  sh.filter((x) => x.kind === 'scene').forEach((x) => assert.strictEqual(x.stage, L.stageOf(x.age).id));
});

test('shotAt finds the right shot and nothing after the end', () => {
  const plan = V.planMovie(finished(2), L.summary(finished(2)), L.STAGES, L.stageOf);
  assert.strictEqual(V.shotAt(plan, 0).index, 0);
  const mid = V.shotAt(plan, plan.shots[3].t0 + 0.1); assert.strictEqual(mid.index, 3); assert.ok(mid.local > 0 && mid.p > 0 && mid.p < 1);
  assert.strictEqual(V.shotAt(plan, plan.duration + 1), null);
  assert.strictEqual(V.fade(0, 4), 1); assert.strictEqual(V.fade(2, 4), 0); assert.ok(V.fade(3.9, 4) > 0.5);
});

test('a movie from a half-lived life works too, and an empty one still has title and end cards', () => {
  const s = L.create({ name: 'Zara', seed: 9 });
  const plan = V.planMovie(s, L.summary(s), L.STAGES, L.stageOf);
  assert.ok(plan.shots.length >= 2);
  const mid = L.create({ name: 'Zara', seed: 9 }); while (mid.age < 30) { if (mid.pending) L.choose(mid, mid.pending.choices.find((c) => !c.locked).id); else L.advance(mid); }
  assert.ok(V.planMovie(mid, L.summary(mid), L.STAGES, L.stageOf).shots.some((x) => x.kind === 'scene'));
});

test('subtitles show only inside their time window', () => {
  const subs = [{ t0: 1, t1: 4, text: 'a' }, { t0: 6, t1: 8, text: 'b' }];
  assert.strictEqual(V.subtitleAt(subs, 0.5), ''); assert.strictEqual(V.subtitleAt(subs, 2), 'a'); assert.strictEqual(V.subtitleAt(subs, 5), ''); assert.strictEqual(V.subtitleAt(subs, 7), 'b'); assert.strictEqual(V.subtitleAt(subs, 8), '');
});

test('cinematic camera moves slowly and never zooms out below 1', () => {
  for (let p = 0; p <= 1; p += 0.1) { const c = V.cameraAt(p, 3); assert.ok(c.zoom >= 1.08 && c.zoom <= 1.21); assert.ok(Math.abs(c.dx) < 0.03); }
  assert.ok(V.cameraAt(1, 0).zoom > V.cameraAt(0, 0).zoom);
});

test('edgeMask finds the outline of a square and ignores flat areas', () => {
  const w = 20, h = 20, lum = new Uint8Array(w * h).fill(200);
  for (let y = 6; y < 14; y++) for (let x = 6; x < 14; x++) lum[y * w + x] = 20;
  const m = V.edgeMask(lum, w, h, 55);
  assert.strictEqual(m[10 * w + 10], 0, 'inside is flat'); assert.strictEqual(m[2 * w + 2], 0, 'outside is flat');
  assert.strictEqual(m[10 * w + 6], 255, 'left edge'); assert.strictEqual(m[6 * w + 10], 255, 'top edge');
  assert.strictEqual(V.edgeMask(new Uint8Array(9).fill(5), 3, 3, 55).every((v) => v === 0), true);
});

test('today video plan: long days are squeezed to the time limit, short days play at normal speed', () => {
  const pts = []; for (let i = 0; i <= 600; i++) pts.push([i * 0.5, i, 0]);        // 300 s of walking, 600 m
  const ev = [[10, 'Mission complete! +Rs 500'], [150, 'hello']];
  const long = V.dayPlan(pts, ev, { maxSecs: 60 });
  assert.ok(Math.abs(long.body - 60) < 1e-6); assert.ok(Math.abs(long.speed - 5) < 1e-6); assert.strictEqual(long.distance, 600);
  assert.ok(Math.abs(long.duration - (60 + long.intro + long.outro)) < 1e-6);
  assert.ok(Math.abs(long.subs[0].t0 - (long.intro + 2)) < 1e-6, 'event at 10 s of the day appears at 2 s of the film');
  const short = V.dayPlan(pts.slice(0, 41), [], { maxSecs: 60 });
  assert.strictEqual(short.speed, 1);
  assert.strictEqual(V.dayPlan([[0, 0, 0]], []), null); assert.strictEqual(V.dayPlan([], []), null);
});

test('dayPos walks along the recorded path', () => {
  const pts = [[0, 0, 0], [1, 10, 0], [2, 10, 10]];
  assert.deepStrictEqual(V.dayPos(pts, 0.5), { x: 5, z: 0, dx: 10, dz: 0 });
  assert.strictEqual(V.dayPos(pts, 1.5).z, 5);
  assert.strictEqual(V.dayPos(pts, -3).x, 0); assert.strictEqual(V.dayPos(pts, 99).z, 10);
  assert.strictEqual(V.dayPos(pts, 99).dx, 0, 'standing still after the end');
});

test('in Node (no browser) nothing tries to record', () => { assert.strictEqual(V.canRecord(), false); assert.strictEqual(V.pickMime(), ''); });
