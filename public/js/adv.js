// TimeWarp Adventures: shared state for Time Farm, Time Detective and Dinosaur Era.
// ONE plain JSON object: { wallet:{coins,basket,fossils}, farm, det, dino }. The wallet is shared, so what you harvest on the farm
// feeds your pet dino, and the fossils you dig up in the Dinosaur Era are kept next to your coins. Pure logic (no DOM): tests/adventures.test.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpAdv = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEY = 'timewarp-adv-v1';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, a, b, d) => (Number.isFinite(+v) && v !== null && v !== '' ? clamp(Math.round(+v), a, b) : d);
  const id = (v) => String(v || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24);

  function counts(raw, allowed, max) {      // { id: n } with known ids only, 0..max
    const out = {};
    if (raw && typeof raw === 'object') Object.keys(raw).forEach((k) => { if (!allowed || allowed.includes(k)) { const n = num(raw[k], 0, max, 0); if (n) out[id(k)] = n; } });
    return out;
  }
  function fresh() { return { v: 1, wallet: { coins: 150, basket: {}, fossils: {} }, farm: null, det: null, dino: null }; }

  // mods = { Farm, Detective, Dino } (each has init(adv) and sanitize(rawPart)); a part that is missing becomes a clean new one
  function sanitize(raw, mods) {
    const adv = fresh();
    if (!raw || typeof raw !== 'object') { Object.keys(mods || {}).forEach((k) => mods[k].init(adv)); return adv; }
    const w = raw.wallet || {};
    adv.wallet.coins = num(w.coins, 0, 99999999, 150);
    adv.wallet.basket = counts(w.basket, mods && mods.Farm ? mods.Farm.CROP_IDS : null, 9999);
    adv.wallet.fossils = counts(w.fossils, mods && mods.Dino ? mods.Dino.FOSSIL_IDS : null, 9999);
    if (mods) {
      adv.farm = mods.Farm ? mods.Farm.sanitize(raw.farm) : null;
      adv.det = mods.Detective ? mods.Detective.sanitize(raw.det) : null;
      adv.dino = mods.Dino ? mods.Dino.sanitize(raw.dino) : null;
    }
    return adv;
  }

  // browser storage (localStorage). Returns the state; a blocked or broken storage gives a fresh game and never throws.
  function load(storage, mods) {
    let raw = null;
    try { raw = JSON.parse(storage.getItem(KEY)); } catch (e) { raw = null; }
    return sanitize(raw, mods);
  }
  function save(storage, adv) { try { storage.setItem(KEY, JSON.stringify(adv)); return true; } catch (e) { return false; } }

  return { KEY, clamp, num, id, fresh, sanitize, load, save, counts };
});
