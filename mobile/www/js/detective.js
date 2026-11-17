// TimeWarp Time Detective. Something that does not belong in the era (a "time glitch") hides among 8 things in a scene.
// Ask the witnesses (colour, sound, place, power) and rule things out, then point at the glitch. Fewer questions = more stars.
// Cases are generated from small item pools with a seeded random generator: same case id = same case. A case is accepted only if the
// four answers together name exactly one item AND at most one single answer does (so you usually need two or more questions).
// Pure logic: tests/adventures.test.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpDetective = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ERAS = ['past', 'present', 'future'];
  const ATTRS = ['color', 'sound', 'place', 'power'];
  const ASK = {
    color: { label: '🎨 Us ka rang kaisa tha?', say: (v) => 'Us ka rang ' + v + ' tha.' },
    sound: { label: '🔊 Koi awaaz aa rahi thi?', say: (v) => v === 'khamosh' ? 'Bilkul khamosh thi, koi awaaz nahi.' : 'Us se "' + v + '" ki awaaz aa rahi thi.' },
    place: { label: '📍 Wo kahan thi?', say: (v) => 'Wo ' + v + ' mein/ke paas thi.' },
    power: { label: '⚙️ Wo kaise chalti thi?', say: (v) => 'Wo ' + v + ' se chalti thi.' },
  };
  // [icon, name, color, sound, place, power]
  const POOL = {
    past: {
      title: 'Purane gaon ka bazaar (1950)', intro: 'Gaon ke bazaar mein koi cheez is zamane ki nahi lagti. Dhoondo kaun si!',
      witnesses: ['Chacha Rafiq (chai wala)', 'Dadi Amma', 'Master Jamil', 'Bilal (chhota bachcha)'],
      normal: [['🐴', 'Tonga', 'bhura', 'tak-tak', 'sarak', 'ghode'], ['🏺', 'Matka', 'laal', 'khamosh', 'kuein', 'haath'], ['🪔', 'Diya', 'peela', 'khamosh', 'dukan', 'tel'],
        ['🧵', 'Charkha', 'bhura', 'ghar-ghar', 'chaupal', 'haath'], ['🔔', 'Mandir ki ghanti', 'sunehra', 'tun-tun', 'mandir', 'haath'], ['📻', 'Purana radio', 'kaala', 'sarsarahat', 'chai ki dukan', 'battery'],
        ['🪣', 'Baalti', 'chaandi', 'khamosh', 'kuein', 'haath'], ['🥁', 'Dhol', 'bhura', 'dham-dham', 'chaupal', 'haath'], ['🛞', 'Bail gaari', 'bhura', 'kirr-kirr', 'sarak', 'bail'],
        ['🏮', 'Fanoos', 'laal', 'khamosh', 'dukan', 'tel'], ['🫖', 'Samavar', 'sunehra', 'sees-sees', 'chai ki dukan', 'koyle'], ['🕊️', 'Kabootar', 'safed', 'ghutar-ghoon', 'aasman', 'parr'],
        ['🪁', 'Patang', 'peela', 'phar-phar', 'aasman', 'hawa']],
      glitch: [['📱', 'Mobile phone', 'kaala', 'beep-beep', 'chai ki dukan', 'battery'], ['🚁', 'Drone', 'safed', 'bhin-bhin', 'aasman', 'battery'],
        ['💻', 'Laptop', 'chaandi', 'tik-tik', 'dukan', 'battery'], ['🛵', 'Electric scooter', 'laal', 'hum-hum', 'sarak', 'battery']],
    },
    present: {
      title: 'Aaj ka bazaar aur park', intro: 'Aaj ke shehar mein ek cheez kisi aur zamane se aa gayi hai. Pakdo use!',
      witnesses: ['Uncle Saleem (dukaandar)', 'Aapa Sara', 'Hamza (school ka bachcha)', 'Guard Akram'],
      normal: [['🚌', 'Bus', 'peela', 'pon-pon', 'sarak', 'diesel'], ['🛺', 'Rickshaw', 'hara', 'tuk-tuk', 'sarak', 'petrol'], ['🚲', 'Cycle', 'kaala', 'tring-tring', 'sarak', 'paaon'],
        ['🛵', 'Moto-cycle', 'laal', 'bhar-bhar', 'sarak', 'petrol'], ['🍦', 'Ice-cream wali gaari', 'safed', 'ghanti', 'park', 'paaon'], ['⛲', 'Fawwara', 'neela', 'chhap-chhap', 'park', 'bijli'],
        ['📺', 'TV', 'kaala', 'baatein', 'dukan', 'bijli'], ['☎️', 'Telephone', 'kaala', 'tring-tring', 'dukan', 'bijli'], ['🔊', 'Loudspeaker', 'kaala', 'azan', 'masjid', 'bijli'],
        ['🛝', 'Jhoola', 'laal', 'chirr-chirr', 'park', 'haath'], ['🚦', 'Signal', 'hara', 'khamosh', 'sarak', 'bijli'], ['🧊', 'Fridge', 'safed', 'hum-hum', 'dukan', 'bijli'],
        ['🎠', 'Merry-go-round', 'bhura', 'chaan-chaan', 'park', 'ghode'], ['⌨️', 'Keyboard', 'kaala', 'tak-tak', 'dukan', 'bijli'], ['🎈', 'Ghubbara', 'chaandi', 'khamosh', 'aasman', 'hawa'],
        ['🚨', 'Siren', 'laal', 'wooo-wooo', 'sarak', 'bijli'], ['🐕', 'Kutta', 'bhura', 'bhau-bhau', 'park', 'zinda jaan'], ['🔦', 'Torch', 'safed', 'khamosh', 'dukan', 'battery'],
        ['🧮', 'Calculator', 'kaala', 'bip-bip', 'dukan', 'battery']],
      glitch: [['🛸', 'Udta tashtari (UFO)', 'chaandi', 'wooo-wooo', 'aasman', 'anjaan taqat'], ['🐴', 'Tonga', 'bhura', 'tak-tak', 'sarak', 'ghode'],
        ['🦖', 'Dinosaur', 'hara', 'grrr', 'park', 'zinda jaan'], ['🤖', 'Robot', 'chaandi', 'bip-bip', 'sarak', 'battery']],
    },
    future: {
      title: 'Shehr 2050 ka chowk', intro: 'Is chamakte hue shehr mein ek cheez purane zamane ki hai. Ye time glitch kaun sa hai?',
      witnesses: ['Robot guard R-7', 'Dr. Noor', 'Zara (hover board wali bachchi)', 'Hologram guide'],
      normal: [['🚁', 'Taxi drone', 'safed', 'hum-hum', 'aasman', 'bijli'], ['🤖', 'Robot dukaandar', 'chaandi', 'bip-bip', 'bazaar', 'bijli'], ['🚄', 'Hyperloop', 'chaandi', 'wooosh', 'station', 'magnet'],
        ['🛴', 'Hover board', 'neela', 'hum-hum', 'sarak', 'bijli'], ['🌳', 'Vertical garden', 'hara', 'khamosh', 'chhat', 'dhoop'], ['🧊', 'Hologram', 'neela', 'khamosh', 'chowk', 'bijli'],
        ['🛸', 'Udti gaari', 'laal', 'hum-hum', 'aasman', 'bijli'], ['🖨️', '3D printer', 'safed', 'ghar-ghar', 'ghar', 'bijli'], ['☀️', 'Solar darakht', 'hara', 'khamosh', 'chowk', 'dhoop'],
        ['🛰️', 'Satellite dish', 'safed', 'khamosh', 'chhat', 'dhoop'], ['🚀', 'Chand ki shuttle', 'safed', 'wooosh', 'station', 'raket'],
        ['🐕', 'Robo-kutta', 'bhura', 'bhau-bhau', 'park', 'bijli'], ['🌱', 'Ghaas ka qaleen', 'hara', 'khamosh', 'park', 'ghaas'], ['🕶️', 'Smart chashma', 'kaala', 'khamosh', 'bazaar', 'bijli'],
        ['🔋', 'Battery pack', 'neela', 'khamosh', 'ghar', 'battery']],
      glitch: [['🐴', 'Ghora', 'bhura', 'hinn-hinn', 'sarak', 'ghaas'], ['📻', 'Purana radio', 'kaala', 'sarsarahat', 'bazaar', 'battery'],
        ['🧵', 'Charkha', 'bhura', 'ghar-ghar', 'ghar', 'haath'], ['☎️', 'Purana dial telephone', 'kaala', 'tring-tring', 'ghar', 'bijli']],
    },
  };
  const rng = (seed) => { let s = seed | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (a, r) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const toItem = (row, id) => ({ id, icon: row[0], name: row[1], attrs: { color: row[2], sound: row[3], place: row[4], power: row[5] } });
  const same = (a, b) => ATTRS.every((k) => a.attrs[k] === b.attrs[k]);

  // accepted only when 4 answers name exactly one item and at most one single answer does
  function goodSet(items, g) {
    const others = items.filter((x) => x !== g);
    if (others.some((o) => same(o, g))) return false;
    return ATTRS.filter((k) => !others.some((o) => o.attrs[k] === g.attrs[k])).length <= 1;
  }
  function makeCase(era, seed) {
    const P = POOL[era]; if (!P) throw new Error('Unknown era');
    const r = rng(seed * 7919 + ERAS.indexOf(era) * 104729 + 13);
    for (let tries = 0; tries < 800; tries++) {
      const gRow = P.glitch[Math.floor(r() * P.glitch.length)];
      const picked = shuffle(P.normal, r).slice(0, 7).map((row) => toItem(row, ''));
      const g = toItem(gRow, '');
      const all = shuffle(picked.concat([g]), r);
      if (!goodSet(all, g)) continue;
      all.forEach((it, i) => { it.id = 'i' + i; });
      const wrong = all.filter((x) => x !== g);
      return { id: era + '-' + seed, era, seed, title: P.title, intro: P.intro, witnesses: P.witnesses, items: all, glitch: g.id, rumour: wrong[Math.floor(r() * wrong.length)].id };
    }
    throw new Error('No case could be made for ' + era + ' ' + seed);
  }
  const CASE_IDS = [];
  ERAS.forEach((e) => [1, 2, 3].forEach((n) => CASE_IDS.push(e + '-' + n)));
  const caseCache = {};
  function getCase(id) {
    const m = /^(past|present|future)-(\d{1,5})$/.exec(String(id)); if (!m) return null;
    return caseCache[id] || (caseCache[id] = makeCase(m[1], +m[2]));
  }
  // the daily case: era and seed follow the date number (days since 1970), so everybody gets the same case on the same day
  function dailyCase(dayNumber) { return getCase(ERAS[dayNumber % 3] + '-' + (100 + (dayNumber % 900))); }

  function init(adv) { if (!adv.det) adv.det = { stars: {} }; return adv.det; }
  function sanitize(raw) {
    const d = { stars: {} };
    if (raw && raw.stars && typeof raw.stars === 'object') Object.keys(raw.stars).forEach((k) => {
      const n = Math.floor(+raw.stars[k]);
      if (/^(past|present|future)-\d{1,5}$/.test(k) && n >= 1 && n <= 3) d.stars[k] = n;
    });
    return d;
  }
  const newSession = (c) => ({ caseId: c.id, asked: [], rumourAsked: false, wrong: 0, over: false, solved: false });
  function ask(c, s, q) {
    if (s.over) return { ok: false, why: 'Ye case khatam ho chuka hai' };
    const w = c.witnesses[(s.asked.length + (s.rumourAsked ? 1 : 0)) % c.witnesses.length];
    if (q === 'rumour') {
      if (s.rumourAsked) return { ok: false, why: 'Afwah pehle hi sun chuke hain' };
      s.rumourAsked = true; const it = c.items.find((x) => x.id === c.rumour);
      return { ok: true, q, rumour: true, who: w, text: 'Sunna hai ke ' + it.icon + ' ' + it.name + ' kuch ajeeb thi... par pakka nahi, ye sirf afwah hai.' };
    }
    if (!ATTRS.includes(q)) return { ok: false, why: 'Ye sawal maujood nahi' };
    if (s.asked.includes(q)) return { ok: false, why: 'Ye sawal pehle pooch chuke hain' };
    s.asked.push(q); const g = c.items.find((x) => x.id === c.glitch);
    return { ok: true, q, who: w, text: ASK[q].say(g.attrs[q]) };
  }
  // items that still match every answer heard so far (the rumour does not count)
  function candidates(c, s) {
    const g = c.items.find((x) => x.id === c.glitch);
    return c.items.filter((it) => s.asked.every((q) => it.attrs[q] === g.attrs[q])).map((it) => it.id);
  }
  const starsFor = (s) => Math.max(1, (s.asked.length + (s.rumourAsked ? 1 : 0) <= 2 ? 3 : s.asked.length + (s.rumourAsked ? 1 : 0) <= 3 ? 2 : 1) - s.wrong);
  // point at an item. 3 wrong guesses end the case. Returns {ok, right, stars, coins, over}
  function accuse(adv, c, s, itemId) {
    if (s.over) return { ok: false, why: 'Ye case khatam ho chuka hai' };
    if (!c.items.some((x) => x.id === itemId)) return { ok: false, why: 'Ye cheez is scene mein nahi' };
    if (itemId !== c.glitch) {
      s.wrong += 1; if (s.wrong >= 3) { s.over = true; return { ok: true, right: false, over: true, say: 'Teen galat ishare... time glitch bach nikla. Dobara koshish karein!' }; }
      return { ok: true, right: false, over: false, say: 'Ye time glitch nahi hai. ' + (3 - s.wrong) + ' mauqe baqi.' };
    }
    s.over = true; s.solved = true;
    const stars = starsFor(s), old = adv.det.stars[c.id] || 0;
    let coins = 0;
    if (stars > old) { coins = 40 * (stars - old); adv.det.stars[c.id] = stars; adv.wallet.coins = Math.min(99999999, adv.wallet.coins + coins); }
    return { ok: true, right: true, over: true, stars, coins, say: 'Shabaash! Time glitch pakda gaya.' };
  }
  const totalStars = (adv) => Object.values(adv.det.stars).reduce((a, b) => a + b, 0);
  const RANKS = [[0, 'Naya jasoos 🔍'], [3, 'Gali ka jasoos 🕵️'], [9, 'Senior jasoos 🧐'], [18, 'Waqt ka Sherlock ⏳']];
  const rank = (adv) => { const t = totalStars(adv); return RANKS.filter((r) => t >= r[0]).pop()[1]; };

  return { ERAS, ATTRS, ASK, POOL, CASE_IDS, makeCase, getCase, dailyCase, init, sanitize, newSession, ask, candidates, accuse, starsFor, totalStars, rank };
});
