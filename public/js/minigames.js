// TimeWarp mini-games for Life Mode. Four small games; each gives a score from 0 to 1 that the life engine turns into good or bad results.
//   tap     tap the big button as many times as you can in 6 seconds
//   memory  find the matching pairs (fewer wrong tries = better score)
//   quiz    five questions (maths and general knowledge), level 1 (small child) to 3 (matric / college)
//   steady  stop the moving marker inside the green zone, three times
// The pure part (questions, scoring) is tested in tests/minigames.test.js; run() is the screen and only exists in a browser.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpGames = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rng(seed) { let s = seed | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const GK = [
    ['Pakistan ki rajdhani kaun si hai?', 'Islamabad', ['Lahore', 'Karachi', 'Peshawar']],
    ['Quaid-e-Azam ka poora naam kya tha?', 'Muhammad Ali Jinnah', ['Liaquat Ali Khan', 'Allama Iqbal', 'Sir Syed Ahmad Khan']],
    ['Pakistan ka qaumi phool kaun sa hai?', 'Chambeli (Jasmine)', ['Gulab', 'Sooraj mukhi', 'Kanwal']],
    ['Pakistan ka qaumi jaanwar kaun sa hai?', 'Markhor', ['Sher', 'Hathi', 'Bhaiya']],
    ['Hafte mein kitne din hote hain?', '7', ['5', '6', '8']],
    ['Suraj kis disha se nikalta hai?', 'Mashriq (East)', ['Maghrib (West)', 'Shumal (North)', 'Junoob (South)']],
    ['Duniya ka sab se bara samandar kaun sa hai?', 'Pacific', ['Atlantic', 'Hind', 'Arctic']],
    ['Paani ka formula kya hai?', 'H2O', ['CO2', 'O2', 'NaCl']],
    ['Insaan ke jism mein dil ka kaam kya hai?', 'Khoon pump karna', ['Khana hazam karna', 'Saans lena', 'Sochna']],
    ['Pakistan ka sab se unchi chotti kaun si hai?', 'K2', ['Nanga Parbat', 'Tirich Mir', 'Rakaposhi']],
    ['Pakistan ka sab se bara shehar kaun sa hai?', 'Karachi', ['Lahore', 'Multan', 'Quetta']],
    ['Ek saal mein kitne mahine hote hain?', '12', ['10', '11', '13']],
    ['Roshni ki raftar kis se tez hai?', 'Awaaz se', ['Hawai jahaz se', 'Bijli se', 'Gaari se']],
    ['Pakistan ke jhande mein sabz rang kis ki nishani hai?', 'Muslim aksariyat', ['Kisan', 'Jungle', 'Amn']],
  ];

  // question(level, rand) -> { q, options: [4 strings], answer: index }
  function question(level, r) {
    let q, correct, wrong;
    const kind = level === 1 ? 0 : level === 2 ? (r() < 0.65 ? 1 : 3) : (r() < 0.7 ? 2 : 3);
    const n = (a, b) => a + Math.floor(r() * (b - a + 1));
    if (kind === 3) {
      const g = GK[Math.floor(r() * GK.length)];
      q = g[0]; correct = g[1]; wrong = g[2];
    } else {
      let ans;
      if (kind === 0) { const a = n(1, 9), b = n(1, 9); q = a + ' + ' + b + ' = ?'; ans = a + b; }
      else if (kind === 1) { if (r() < 0.5) { const a = n(2, 12), b = n(2, 12); q = a + ' × ' + b + ' = ?'; ans = a * b; } else { const a = n(20, 99), b = n(5, 19); q = a + ' − ' + b + ' = ?'; ans = a - b; } }
      else { const t = n(0, 2); if (t === 0) { const a = n(3, 15); q = a + '² = ?'; ans = a * a; } else if (t === 1) { const p = [10, 20, 25, 50][n(0, 3)], v = [40, 80, 120, 200][n(0, 3)]; q = p + '% of ' + v + ' = ?'; ans = (p * v) / 100; } else { const a = n(3, 12), b = n(3, 12), c = n(5, 40); q = a + ' × ' + b + ' + ' + c + ' = ?'; ans = a * b + c; } }
      correct = String(ans);
      const set = new Set([correct]); wrong = [];
      for (let g = 0; g < 50 && wrong.length < 3; g++) { const d = String(ans + (n(1, 6)) * (r() < 0.5 ? -1 : 1)); if (!set.has(d) && Number(d) >= 0) { set.add(d); wrong.push(d); } }
      while (wrong.length < 3) wrong.push(String(ans + 7 + wrong.length));
    }
    const options = shuffle([correct].concat(wrong), r);
    return { q, options, answer: options.indexOf(correct) };
  }
  const makeQuiz = (level, seed, count) => { const r = rng(seed); return Array.from({ length: count || 5 }, () => question(clamp(level || 1, 1, 3), r)); };
  const scoreQuiz = (answers, questions) => (questions.length ? questions.filter((q, i) => answers[i] === q.answer).length / questions.length : 0);

  // tap: 6 s, "target" taps = full marks (a little easier for small children)
  const TAP_TARGET = 30;
  const scoreTap = (taps, target) => clamp(taps / (target || TAP_TARGET), 0, 1);

  // memory: 4 pairs; tries = number of two-card turns. 4 tries is perfect, each extra try costs 1/8.
  const MEMORY_ICONS = ['🍎', '⚽', '🚗', '🧸', '🐦', '🌙', '⭐', '🌳'];
  const makeMemory = (pairs, seed) => { const r = rng(seed); const ic = shuffle(MEMORY_ICONS, r).slice(0, pairs); return shuffle(ic.concat(ic), r); };
  const scoreMemory = (tries, pairs) => clamp(1 - (tries - pairs) / (pairs * 2), 0, 1);

  // steady: marker position p in 0..1, the green zone is the middle (0.5 +- 0.1). 0.5 is perfect, 0 or 1 is the worst.
  const scoreSteady = (stops) => (stops.length ? stops.reduce((a, p) => a + clamp(1 - Math.abs(p - 0.5) / 0.5, 0, 1), 0) / stops.length : 0);
  // position of the marker at time t (seconds): a triangle wave, faster on each round
  const markerAt = (t, round) => { const f = 0.55 + 0.25 * (round || 0), x = (t * f) % 2; return x < 1 ? x : 2 - x; };

  // drive: 3 lanes, 10 s, obstacles fall for FALL seconds. positions = [{t, lane}] lane changes (the car starts in lane 1).
  const FALL = 1.6, DRIVE_SECS = 10;
  function makeDrive(seed) { const r = rng(seed), out = []; for (let t = 1; t < DRIVE_SECS - FALL; t += 0.55 + r() * 0.5) out.push({ t: Math.round(t * 100) / 100, lane: Math.floor(r() * 3) }); return out; }
  function laneAt(positions, t) { let lane = 1; (positions || []).forEach((p) => { if (p.t <= t) lane = p.lane; }); return lane; }
  function scoreDrive(obstacles, positions) { const hits = obstacles.filter((o) => laneAt(positions, o.t + FALL) === o.lane).length; return clamp(1 - hits / 5, 0, 1); }
  // route: a depot and 4 stops on a 9 x 9 map; the score is shortest possible route / your route
  function makeRoute(seed) { const r = rng(seed), pts = new Set(); while (pts.size < 5) pts.add(Math.floor(r() * 9) + ',' + Math.floor(r() * 9)); const a = [...pts].map((p) => p.split(',').map(Number)); return { depot: a[0], stops: a.slice(1) }; }
  const routeLen = (depot, stops, order) => { let len = 0, cur = depot; order.forEach((i) => { len += Math.abs(cur[0] - stops[i][0]) + Math.abs(cur[1] - stops[i][1]); cur = stops[i]; }); return len; };
  function bestRoute(depot, stops) { let best = Infinity; const go = (left, order) => { if (!left.length) { best = Math.min(best, routeLen(depot, stops, order)); return; } left.forEach((i) => go(left.filter((x) => x !== i), order.concat(i))); }; go(stops.map((x, i) => i), []); return best; }
  function scoreRoute(depot, stops, order) { if (order.length !== stops.length || new Set(order).size !== stops.length) return 0; return clamp(bestRoute(depot, stops) / Math.max(1, routeLen(depot, stops, order)), 0, 1); }

  // ---------- screen (browser only) ----------
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  // run(game, {level, seed}) -> Promise<score 0..1>; the overlay is removed when the game ends
  function run(game, opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      const seed = o.seed == null ? Math.floor(Math.random() * 2147483647) : o.seed;
      const overlay = el('div', 'mg-overlay'); overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
      const box = el('div', 'mg-box'); overlay.appendChild(box);
      const timers = [];
      let done = false;
      const finish = (score, msg) => {
        if (done) return; done = true; timers.forEach((t) => { clearInterval(t); clearTimeout(t); cancelAnimationFrame(t); });
        box.textContent = '';
        box.appendChild(el('h3', null, score >= 0.7 ? 'Shabash! 🎉' : score >= 0.4 ? 'Theek raha 👍' : 'Agli baar behtar 💪'));
        box.appendChild(el('p', 'mg-score', Math.round(score * 100) + ' / 100'));
        if (msg) box.appendChild(el('p', 'small muted', msg));
        const b = el('button', 'btn primary', 'Aage barho'); b.type = 'button';
        b.addEventListener('click', () => { overlay.remove(); resolve(score); });
        box.appendChild(b); b.focus();
      };
      const title = (t, hint) => { box.appendChild(el('h3', null, t)); if (hint) box.appendChild(el('p', 'small muted', hint)); };
      const skip = () => { const b = el('button', 'link-btn small mg-skip', 'Chhor do (average nateeja)'); b.type = 'button'; b.addEventListener('click', () => { if (done) return; done = true; timers.forEach((t) => { clearInterval(t); clearTimeout(t); cancelAnimationFrame(t); }); overlay.remove(); resolve(0.5); }); box.appendChild(b); };

      if (game === 'tap') {
        title('Tezi se tap karo!', '6 second mein jitne ho sakein.');
        const big = el('button', 'mg-big', '👶'); big.type = 'button';
        const info = el('p', 'mg-info', 'Tap: 0 · 6 s'); box.appendChild(big); box.appendChild(info);
        let taps = 0, started = 0;
        const target = (o.level || 1) === 1 ? 22 : TAP_TARGET;
        big.addEventListener('click', () => {
          if (!started) { started = performance.now(); timers.push(setInterval(() => { const left = 6 - (performance.now() - started) / 1000; info.textContent = 'Tap: ' + taps + ' · ' + Math.max(0, Math.ceil(left)) + ' s'; if (left <= 0) finish(scoreTap(taps, target), taps + ' tap kiye.'); }, 100)); }
          taps++; info.textContent = 'Tap: ' + taps;
        });
        skip(); big.focus();
      } else if (game === 'memory') {
        title('Jodiyan milao', 'Do card kholo; agar ek jaisay hon to jodi ban jati hai.');
        const pairs = 4, cards = makeMemory(pairs, seed), grid = el('div', 'mg-grid');
        let open = [], matched = 0, tries = 0, lock = false;
        const info = el('p', 'mg-info', 'Koshishen: 0');
        const btns = cards.map((icon, i) => {
          const b = el('button', 'mg-card', '❓'); b.type = 'button'; b.setAttribute('aria-label', 'Card ' + (i + 1));
          b.addEventListener('click', () => {
            if (lock || b.dataset.on) return;
            b.textContent = icon; b.dataset.on = '1'; open.push(i);
            if (open.length === 2) {
              tries++; info.textContent = 'Koshishen: ' + tries;
              const [x, y] = open; open = [];
              if (cards[x] === cards[y]) { matched++; btns[x].disabled = btns[y].disabled = true; if (matched === pairs) timers.push(setTimeout(() => finish(scoreMemory(tries, pairs), tries + ' koshishon mein.'), 500)); }
              else { lock = true; timers.push(setTimeout(() => { [x, y].forEach((k) => { btns[k].textContent = '❓'; delete btns[k].dataset.on; }); lock = false; }, 700)); }
            }
          });
          grid.appendChild(b); return b;
        });
        box.appendChild(grid); box.appendChild(info); skip(); btns[0].focus();
      } else if (game === 'quiz') {
        const qs = makeQuiz(o.level, seed, 5), answers = [];
        let i = 0;
        const show = () => {
          box.textContent = '';
          title('Sawal ' + (i + 1) + ' / ' + qs.length);
          box.appendChild(el('p', 'mg-q', qs[i].q));
          qs[i].options.forEach((opt, k) => {
            const b = el('button', 'btn mg-opt', opt); b.type = 'button';
            b.addEventListener('click', () => { answers[i] = k; i++; if (i < qs.length) show(); else finish(scoreQuiz(answers, qs), answers.filter((a, j) => a === qs[j].answer).length + ' / ' + qs.length + ' sahi.'); });
            box.appendChild(b);
          });
          skip();
        };
        show();
      } else if (game === 'steady') {
        title('Sahi waqt par roko', 'Marker jab hare hisse mein ho, "Roko" dabao. 3 baar.');
        const track = el('div', 'mg-track'), zone = el('div', 'mg-zone'), mark = el('div', 'mg-mark');
        track.appendChild(zone); track.appendChild(mark);
        const stop = el('button', 'btn primary', 'Roko'); stop.type = 'button';
        const info = el('p', 'mg-info', 'Baari 1 / 3');
        box.appendChild(track); box.appendChild(stop); box.appendChild(info);
        const stops = []; let round = 0, t0 = performance.now(), p = 0;
        const frame = () => { p = markerAt((performance.now() - t0) / 1000, round); mark.style.left = (p * 100) + '%'; timers.push(requestAnimationFrame(frame)); };
        frame();
        stop.addEventListener('click', () => {
          stops.push(p); round++;
          if (round >= 3) finish(scoreSteady(stops), 'Sab se qareeb baari: ' + Math.round((1 - Math.min(...stops.map((x) => Math.abs(x - 0.5))) / 0.5) * 100) + '%.');
          else { info.textContent = 'Baari ' + (round + 1) + ' / 3'; t0 = performance.now(); }
        });
        skip(); stop.focus();
      } else if (game === 'drive') {
        title('Rukawaton se bacho!', 'Left / Right ya neeche ke buttons se lane badlo. 10 second.');
        const obs = makeDrive(seed), pos = [], road = el('div', 'mg-road'), car = el('div', 'mg-car', '🚕'), info = el('p', 'mg-info', '10 s');
        const nodes = obs.map((o) => { const n = el('div', 'mg-obs', '🚧'); n.style.left = (o.lane * 33.3 + 16.6) + '%'; n.style.top = '-40px'; road.appendChild(n); return n; });
        const started = performance.now();
        road.appendChild(car); let lane = 1; const setLane = (l) => { lane = clamp(l, 0, 2); car.style.left = (lane * 33.3 + 16.6) + '%'; if (started) pos.push({ t: (performance.now() - started) / 1000, lane }); }; setLane(1);
        const row = el('div', 'mg-row'); [['◀', -1], ['▶', 1]].forEach(([t, d]) => { const b = el('button', 'btn mg-opt', t); b.type = 'button'; b.addEventListener('click', () => setLane(lane + d)); row.appendChild(b); });
        const onKey = (e) => { if (!overlay.isConnected && started) { un(); return; } if (e.key === 'ArrowLeft') { setLane(lane - 1); e.preventDefault(); } else if (e.key === 'ArrowRight') { setLane(lane + 1); e.preventDefault(); } };
        document.addEventListener('keydown', onKey); const un = () => document.removeEventListener('keydown', onKey);
        box.appendChild(road); box.appendChild(row); box.appendChild(info);
        const frame = () => { const t = (performance.now() - started) / 1000; obs.forEach((o, i) => { const p = (t - o.t) / FALL; nodes[i].style.top = (p < 0 || p > 1.1 ? -40 : p * 100) + '%'; nodes[i].style.opacity = p < 0 || p > 1 ? 0 : 1; });
          info.textContent = Math.max(0, Math.ceil(DRIVE_SECS - t)) + ' s';
          if (t >= DRIVE_SECS) { un(); finish(scoreDrive(obs, pos), Math.round((1 - scoreDrive(obs, pos)) * 5) + ' baar takraye.'); return; }
          timers.push(requestAnimationFrame(frame)); };
        frame(); skip();
      } else if (game === 'route') {
        title('Sab se chhota raasta', 'Depot (🏠) se shuru karo aur chaaron ghar (📦) ek ek kar ke chuno.');
        const { depot, stops } = makeRoute(seed), grid = el('div', 'mg-map'), order = [], info = el('p', 'mg-info', 'Faasla: 0');
        const cells = [];
        for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
          const c = el('button', 'mg-cell'); c.type = 'button'; c.setAttribute('aria-label', 'Khana ' + (x + 1) + ',' + (y + 1));
          if (x === depot[0] && y === depot[1]) c.textContent = '🏠';
          const si = stops.findIndex((s2) => s2[0] === x && s2[1] === y);
          if (si >= 0) { c.textContent = '📦'; c.addEventListener('click', () => { if (order.includes(si)) return; order.push(si); c.textContent = String(order.length); c.disabled = true; info.textContent = 'Faasla: ' + routeLen(depot, stops, order); if (order.length === stops.length) finish(scoreRoute(depot, stops, order), 'Aap ka raasta ' + routeLen(depot, stops, order) + ', behtareen ' + bestRoute(depot, stops) + '.'); }); } else c.disabled = true;
          grid.appendChild(c); cells.push(c);
        }
        box.appendChild(grid); box.appendChild(info); skip();
      } else if (game === 'licence') {
        overlay.remove(); done = true;
        run('quiz', { level: 3, seed }).then((a) => run('steady', { seed }).then((b) => resolve((a + b) / 2)));
        return;
      } else { resolve(0.5); return; }
      document.body.appendChild(overlay);
    });
  }

  return { GK, rng, question, makeQuiz, scoreQuiz, scoreTap, TAP_TARGET, makeMemory, scoreMemory, scoreSteady, markerAt, makeDrive, laneAt, scoreDrive, FALL, DRIVE_SECS, makeRoute, routeLen, bestRoute, scoreRoute, run };
});
