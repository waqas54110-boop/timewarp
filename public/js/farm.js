// TimeWarp Time Farm. One field (6 plots) that exists in all three eras. Plant a seed in one era, travel through time, harvest in another.
//  - Every era sells different seeds (past: gandum, sarson, ganna; present: tamatar, makai, aam; future: hydroponic salad, space strawberry).
//  - A crop is ripe after `days` days in the same era, or as soon as you have travelled one era step. Each crop survives only `keeps` era steps (hydroponic salad: none), then it rots.
//  - "Waqt ka phal" (time fruit) only ripens after 2 to 3 era steps and is worth a fortune.
//  - Water a plot in every era you pass through: +1 fruit per different era watered.
//  - Selling: future pays 1.5x, past 0.8x, and a crop sold outside the era it comes from gets a 25% "nayab" bonus.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpFarm = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ERAS = ['past', 'present', 'future'];
  const ERA_INFO = {
    past: { name: 'Past (1950 ka gaon)', icon: '🛖', market: 0.8, rain: 'Qudrati baarish' },
    present: { name: 'Present (aaj)', icon: '🏡', market: 1, rain: 'Tubewell' },
    future: { name: 'Future (2050)', icon: '🏙️', market: 1.5, rain: 'Drone sprinkler' },
  };
  const CROPS = [
    { id: 'gandum', name: 'Gandum', icon: '🌾', era: 'past', seed: 20, sell: 55, days: 4, keeps: 4 },
    { id: 'sarson', name: 'Sarson', icon: '🌼', era: 'past', seed: 15, sell: 40, days: 3, keeps: 3 },
    { id: 'ganna', name: 'Ganna', icon: '🎋', era: 'past', seed: 30, sell: 80, days: 6, keeps: 2 },
    { id: 'tamatar', name: 'Tamatar', icon: '🍅', era: 'present', seed: 25, sell: 70, days: 3, keeps: 2 },
    { id: 'makai', name: 'Makai', icon: '🌽', era: 'present', seed: 25, sell: 65, days: 4, keeps: 3 },
    { id: 'aam', name: 'Aam', icon: '🥭', era: 'present', seed: 60, sell: 200, days: 8, keeps: 4 },
    { id: 'salad', name: 'Hydroponic salad', icon: '🥬', era: 'future', seed: 40, sell: 120, days: 2, keeps: 0 },
    { id: 'strawberry', name: 'Space strawberry', icon: '🍓', era: 'future', seed: 70, sell: 220, days: 3, keeps: 1 },
    { id: 'timefruit', name: 'Waqt ka phal', icon: '🔮', era: 'any', seed: 150, sell: 900, days: 99, keeps: 3, minSteps: 2 },
  ];
  const BY = {}; CROPS.forEach((c) => { BY[c.id] = c; });
  const CROP_IDS = CROPS.map((c) => c.id);
  const START_PLOTS = 6, MAX_PLOTS = 9, PLOT_PRICE = 120;

  function init(adv) {
    if (!adv.farm) adv.farm = { era: 'present', day: 0, plots: Array.from({ length: START_PLOTS }, () => null), harvested: 0, timefruits: 0, sold: 0 };
    return adv.farm;
  }
  const no = (why) => ({ ok: false, why });
  const idx = (f, i) => (Number.isInteger(i) && i >= 0 && i < f.plots.length ? i : -1);

  // 'empty' | 'growing' | 'ripe' | 'rotten'
  function status(f, i) {
    const p = f.plots[i]; if (!p) return 'empty';
    const c = BY[p.crop];
    if (p.steps > c.keeps) return 'rotten';
    if (c.minSteps) return p.steps >= c.minSteps ? 'ripe' : 'growing';
    return p.steps >= 1 || p.days >= c.days ? 'ripe' : 'growing';
  }
  const seedPrice = (c) => c.seed;
  function plant(adv, i, cropId) {
    const f = adv.farm, c = BY[cropId]; i = idx(f, i);
    if (i < 0) return no('Ye plot maujood nahi');
    if (!c) return no('Ye beej maujood nahi');
    if (c.era !== 'any' && c.era !== f.era) return no(c.name + ' ka beej sirf ' + ERA_INFO[c.era].name + ' mein milta hai');
    if (f.plots[i]) return no('Plot khali nahi hai');
    if (adv.wallet.coins < seedPrice(c)) return no('Paise kam hain (beej Rs ' + seedPrice(c) + ')');
    adv.wallet.coins -= seedPrice(c);
    f.plots[i] = { crop: c.id, days: 0, steps: 0, wat: [] };
    return { ok: true, say: c.icon + ' ' + c.name + ' bo diya' };
  }
  function water(adv, i) {
    const f = adv.farm; i = idx(f, i);
    if (i < 0 || !f.plots[i]) return no('Pehle beej boyen');
    const p = f.plots[i];
    if (status(f, i) === 'rotten') return no('Ye fasal kharab ho chuki hai');
    if (p.wat.includes(f.era)) return no('Is zamane mein is plot ko paani de chuke hain');
    p.wat.push(f.era);
    return { ok: true, say: '💧 ' + ERA_INFO[f.era].rain + ': plot ko paani mil gaya' };
  }
  // a day passes in the current era. Rain (deterministic from the day number) waters every planted plot in the past.
  function nextDay(adv) {
    const f = adv.farm; f.day += 1;
    let rained = false;
    if (f.era === 'past' && f.day % 3 === 0) rained = true;
    f.plots.forEach((p) => { if (!p) return; p.days += 1; if (rained && !p.wat.includes('past')) p.wat.push('past'); });
    return { ok: true, rained, say: rained ? '🌧️ Baarish hui, past ke saare plot sairaab' : '☀️ Ek din guzar gaya' };
  }
  // travel to another era: every planted plot gets one step per era passed (past -> future = 2 steps)
  function travel(adv, era) {
    const f = adv.farm;
    if (!ERAS.includes(era)) return no('Aisa koi zamana nahi');
    if (era === f.era) return no('Aap pehle se yahin hain');
    const steps = Math.abs(ERAS.indexOf(era) - ERAS.indexOf(f.era));
    f.era = era;
    let rotten = 0, ripe = 0;
    f.plots.forEach((p, i) => { if (!p) return; p.steps += steps; const s = status(f, i); if (s === 'rotten') rotten += 1; else if (s === 'ripe') ripe += 1; });
    return { ok: true, steps, rotten, ripe, say: '⏳ ' + steps + ' qadam waqt mein safar: ' + ripe + ' fasal tayyar' + (rotten ? ', ' + rotten + ' kharab ho gayi' : '') };
  }
  function harvest(adv, i) {
    const f = adv.farm; i = idx(f, i);
    if (i < 0 || !f.plots[i]) return no('Yahan koi fasal nahi');
    const s = status(f, i), p = f.plots[i], c = BY[p.crop];
    if (s === 'growing') return no('Abhi pakki nahi');
    f.plots[i] = null;
    if (s === 'rotten') return { ok: true, rotten: true, qty: 0, say: '🥀 Fasal waqt ke safar mein kharab ho gayi, plot saaf kar diya' };
    const qty = 2 + p.wat.length;      // 2 fruits + 1 for every different era it was watered in
    adv.wallet.basket[c.id] = Math.min(9999, (adv.wallet.basket[c.id] || 0) + qty);
    f.harvested += qty; if (c.id === 'timefruit') f.timefruits += qty;
    return { ok: true, qty, crop: c.id, say: c.icon + ' ' + qty + ' ' + c.name + ' mili' + (p.wat.length > 1 ? ' (' + p.wat.length + ' zamanon ka paani!)' : '') };
  }
  function unitPrice(cropId, era) {
    const c = BY[cropId]; const base = c.sell * ERA_INFO[era].market;
    return Math.round(base * (c.era !== 'any' && c.era !== era ? 1.25 : 1));
  }
  // sell n of one crop (n = 'all' sells everything of it)
  function sell(adv, cropId, n) {
    const f = adv.farm, have = adv.wallet.basket[cropId] || 0;
    if (!BY[cropId] || !have) return no('Tokri mein ye fasal nahi hai');
    const q = n === 'all' || n === undefined ? have : Math.min(have, Math.max(1, Math.floor(+n) || 1));
    const total = unitPrice(cropId, f.era) * q;
    adv.wallet.basket[cropId] = have - q; if (!adv.wallet.basket[cropId]) delete adv.wallet.basket[cropId];
    adv.wallet.coins = Math.min(99999999, adv.wallet.coins + total); f.sold += q;
    return { ok: true, total, qty: q, say: '💰 ' + q + ' ' + BY[cropId].name + ' bech kar Rs ' + total + ' mile' };
  }
  function buyPlot(adv) {
    const f = adv.farm;
    if (f.plots.length >= MAX_PLOTS) return no('Khet ab poora bhar gaya hai');
    if (adv.wallet.coins < PLOT_PRICE) return no('Naye plot ke liye Rs ' + PLOT_PRICE + ' chahiye');
    adv.wallet.coins -= PLOT_PRICE; f.plots.push(null);
    return { ok: true, say: '🟫 Naya plot khareed liya' };
  }
  function sanitize(raw) {
    const f = { era: 'present', day: 0, plots: Array.from({ length: START_PLOTS }, () => null), harvested: 0, timefruits: 0, sold: 0 };
    if (!raw || typeof raw !== 'object') return f;
    const n = (v, a, b, d) => (Number.isFinite(+v) && v !== null && v !== '' ? clamp(Math.round(+v), a, b) : d);
    f.era = ERAS.includes(raw.era) ? raw.era : 'present';
    f.day = n(raw.day, 0, 99999, 0); f.harvested = n(raw.harvested, 0, 999999, 0); f.timefruits = n(raw.timefruits, 0, 99999, 0); f.sold = n(raw.sold, 0, 999999, 0);
    const plots = Array.isArray(raw.plots) ? raw.plots.slice(0, MAX_PLOTS) : [];
    f.plots = Array.from({ length: clamp(plots.length, START_PLOTS, MAX_PLOTS) }, (_, i) => {
      const p = plots[i]; if (!p || !BY[p.crop]) return null;
      const wat = (Array.isArray(p.wat) ? p.wat : []).filter((e, k, a) => ERAS.includes(e) && a.indexOf(e) === k);
      return { crop: p.crop, days: n(p.days, 0, 99, 0), steps: n(p.steps, 0, 99, 0), wat };
    });
    return f;
  }
  return { ERAS, ERA_INFO, CROPS, BY, CROP_IDS, START_PLOTS, MAX_PLOTS, PLOT_PRICE, init, status, plant, water, nextDay, travel, harvest, unitPrice, sell, buyPlot, sanitize };
});
