// Time Machine upgrades: points you earn from finished lives, spent on perks that change how the NEXT lives start.
// meta = { points, perks: [ids you own], best: best Life Score, lang: 'ur' | 'rm' | 'en', lives: how many lives you finished }
// The perks themselves (names, prices, effects) live in life.js (TimeWarpLife.PERKS) so the life engine can apply them.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpMeta = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LANGS = ['ur', 'rm', 'en'];
  const int = (v, a, b, d) => (Number.isFinite(v) ? Math.max(a, Math.min(b, Math.round(v))) : d);
  const fresh = () => ({ points: 0, perks: [], best: 0, lang: 'rm', lives: 0 });

  // sanitize(raw, PERKS): a clean meta from anything (a saved file, the browser, the server)
  function sanitize(raw, PERKS) {
    const m = fresh(); if (!raw || typeof raw !== 'object') return m;
    m.points = int(raw.points, 0, 100000, 0); m.best = int(raw.best, 0, 100, 0); m.lives = int(raw.lives, 0, 10000, 0);
    m.lang = LANGS.includes(raw.lang) ? raw.lang : 'rm';
    m.perks = (Array.isArray(raw.perks) ? raw.perks : []).filter((x, i, a) => PERKS && PERKS[x] && a.indexOf(x) === i);
    return m;
  }
  // pointsFor(summary, life): what a finished life is worth
  function pointsFor(sum, life) {
    return Math.round(sum.score / 2) + Math.min(20, (life.flags.gamesWon || 0)) + (sum.dreamDone ? 10 : 0);
  }
  // claim(meta, life, L): gives the points of a finished life once. Returns {gained} (0 if nothing to claim). The life is marked as paid.
  function claim(meta, life, L) {
    if (!life || !life.over || life.flags.paid) return { gained: 0 };
    const sum = L.summary(life), gained = pointsFor(sum, life);
    life.flags.paid = true; meta.points = Math.min(100000, meta.points + gained); meta.lives += 1; meta.best = Math.max(meta.best, sum.score);
    return { gained, score: sum.score };
  }
  function buy(meta, id, PERKS) {
    const p = PERKS[id]; if (!p) return { ok: false, why: 'Aisa upgrade nahi' };
    if (meta.perks.includes(id)) return { ok: false, why: 'Ye aap ke paas pehle se hai' };
    if (meta.points < p.cost) return { ok: false, why: 'Points kam hain (' + p.cost + ' chahiye)' };
    meta.points -= p.cost; meta.perks.push(id); return { ok: true };
  }
  return { LANGS, fresh, sanitize, pointsFor, claim, buy };
});
