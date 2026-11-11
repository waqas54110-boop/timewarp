// Life Mode screen: start form, age timeline, scene card, choices, stats and the final summary.
// All text goes in with textContent (the name is typed by the player), so nothing can inject HTML.
(function () {
  const L = window.TimeWarpLife;
  const Save = window.TimeWarpSave;
  const Games = window.TimeWarpGames, Art = window.TimeWarpArt;
  const $ = (id) => document.getElementById(id);
  const root = $('life');
  if (!L || !root) return;

  const LABEL = { health: 'Sehat', knowledge: 'Ilm', happiness: 'Khushi', relations: 'Rishtay', money: 'Paisa', sachai: 'Sachai', sabr: 'Sabr aur shukr', walidain: 'Walidain ki izzat', imandari: 'Imandari', padosi: 'Padosi ke haqooq' };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let life = null;
  let lastResult = null;

  function show(which) { ['life-start', 'life-play', 'life-end'].forEach((id) => { $(id).hidden = id !== which; }); }

  function renderTimeline() {
    const wrap = $('life-timeline'); wrap.textContent = '';
    const total = life.endAge || 85;
    L.STAGES.forEach((st) => {
      const item = el('li', 'life-stage' + (life.age >= st.from && life.age <= st.to ? ' now' : life.age > st.to ? ' past' : ''));
      item.appendChild(el('span', 'life-stage-icon', st.icon));
      item.appendChild(el('span', 'life-stage-name', st.name));
      wrap.appendChild(item);
    });
    const pct = Math.min(100, Math.round((life.age / total) * 100));
    $('life-progress').style.width = pct + '%';
    $('life-dot').style.left = pct + '%';
  }

  function renderStats() {
    const box = $('life-stats'); box.textContent = '';
    ['health', 'knowledge', 'happiness', 'relations'].forEach((k) => {
      const row = el('div', 'life-stat');
      row.appendChild(el('span', 'life-stat-name', LABEL[k]));
      const bar = el('div', 'life-bar'); const fill = el('div', 'life-bar-fill'); fill.style.width = life[k] + '%'; bar.appendChild(fill);
      row.appendChild(bar); row.appendChild(el('span', 'life-stat-val', String(life[k])));
      box.appendChild(row);
    });
    $('life-money').textContent = L.fmtRs(life.money);
    const jobName = life.flags.job ? L.JOBS[life.flags.job].name : (life.age < 5 ? 'Abhi chhote hain' : life.age < 22 ? 'Parhai' : 'Koi kaam nahi');
    $('life-job').textContent = jobName + (life.flags.job ? ' · tankhwah ' + L.fmtRs(L.monthlyBase(life)) + ' / mahina' : '');
  }

  function renderLog() {
    const ul = $('life-log'); ul.textContent = '';
    life.log.slice(-14).reverse().forEach((r) => {
      const li = el('li', 'life-log-' + r.kind);
      li.appendChild(el('b', null, r.age + ': '));
      li.appendChild(document.createTextNode(r.text));
      ul.appendChild(li);
    });
  }

  function renderScene() {
    const st = L.stageOf(life.age);
    const scene = $('life-scene');
    scene.className = 'life-scene stage-' + st.id + ' era-' + life.era;
    $('life-age').textContent = String(life.age);
    $('life-year').textContent = 'Year of life ' + (life.age + 1) + ' (zindagi ka saal #' + (life.age + 1) + ')';
    $('life-stage').textContent = st.icon + ' ' + st.name;
    const choices = $('life-choices'); choices.textContent = '';
    const result = $('life-result'); const next = $('life-next');
    if (life.pending) {
      $('life-icon').textContent = life.pending.icon;
      $('life-title').textContent = life.pending.title;
      $('life-text').textContent = life.pending.text;
      result.hidden = true; next.hidden = true;
      life.pending.choices.forEach((c) => {
        const b = el('button', 'btn life-choice', c.label); b.type = 'button';
        if (c.locked) { b.disabled = true; b.appendChild(el('small', 'life-why', 'Band: ' + c.why)); }
        else if (c.game && Games) b.addEventListener('click', () => { Games.run(c.game, { level: c.level, seed: life.rs + life.age }).then((score) => pick(c.id, score)); });
        else b.addEventListener('click', () => pick(c.id));
        choices.appendChild(b);
      });
    } else if (lastResult) {
      $('life-icon').textContent = '✨';
      $('life-title').textContent = 'Nateeja';
      $('life-text').textContent = lastResult.say || 'Zindagi aage barh rahi hai.';
      result.hidden = false; next.hidden = false; next.focus();
      result.textContent = '';
      Object.keys(lastResult.changes).forEach((k) => {
        const d = lastResult.changes[k];
        const label = k === 'money' ? (d > 0 ? '+' : '-') + L.fmtRs(Math.abs(d)) : (d > 0 ? '+' : '') + d;
        result.appendChild(el('span', 'life-chip ' + (d > 0 ? 'up' : 'down'), LABEL[k] + ' ' + label));
      });
    }
  }

  // the cartoon picture on top of the scene: redrawn about 20 times a second (a still picture if the player prefers reduced motion)
  const artCv = $('life-art'), still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let artT = 0;
  function artState() { return { stage: life.stage || L.stageOf(life.age).id, era: life.era, job: life.flags.job, married: !!life.flags.married, children: life.flags.children ? 2 : 0, view: life.flags.children && life.age % 2 ? 'family' : '' }; }
  function drawArt() { if (Art && artCv && life && !$('life-play').hidden) Art.drawScene(artCv.getContext('2d'), artCv.width, artCv.height, artState(), artT); }
  if (Art && artCv && !still) setInterval(() => { artT += 0.05; drawArt(); }, 50);
  function render() { renderTimeline(); renderStats(); renderLog(); renderScene(); drawArt(); }

  // ---------- save (Phase 1): after every step, and every 20 s while playing ----------
  // ---- Time Machine meta (points, perks, language): saved as the third part of the save slot ----
  const Meta = window.TimeWarpMeta, I18 = window.TimeWarpI18n;
  let meta = Meta ? Meta.fresh() : null;
  const saveMeta = () => { if (Save && meta) Save.save('meta', meta); };
  function fillStart() {
    const dsel = $('life-dream');
    if (dsel && dsel.options.length < 2) L.DREAMS.forEach((d) => { const o = document.createElement('option'); o.value = d.id; o.textContent = d.label; dsel.appendChild(o); });
    const pk = $('life-perks');
    if (pk && meta && meta.perks.length) { pk.hidden = false; pk.textContent = (I18 ? I18.t('life.perks') : '') + ' ' + meta.perks.map((id) => L.PERKS[id].icon + ' ' + L.PERKS[id].name).join(', '); }
  }
  const SAVED_TEXT = { saving: 'Save ho raha hai...', saved: 'Save ho gaya', 'saved-local': 'Is browser mein save ho gaya', error: 'Save nahi ho saka' };
  if (Save) Save.onStatus((st) => { $('life-saved').textContent = SAVED_TEXT[st] || ''; });
  const autosave = () => { if (Save && life) Save.save('life', life); };
  setInterval(() => { if (life && !$('life-play').hidden) autosave(); }, 20000);
  function describe(sv) {
    const st = L.stageOf(sv.age);
    return sv.name + ' - ' + sv.age + ' saal (' + st.icon + ' ' + st.name + '), ' + (sv.over ? 'zindagi mukammal' : 'Paisa ' + L.fmtRs(sv.money));
  }
  function resume(saved) {
    life = saved; lastResult = null;
    if (!life.pending && !life.over) L.advance(life);
    if (life.over) { finish(); return; }
    show('life-play'); render();
  }
  async function fresh() { // New Life: forget the saved life, show the start form
    life = null; lastResult = null;
    if (Save) await Save.clear('life');
    $('life-continue').hidden = true; show('life-start'); $('life-name').focus();
  }

  function pick(id, score) {
    lastResult = L.choose(life, id, score === undefined ? undefined : { score });
    autosave();
    if (life.over) { finish(); return; }
    render();
  }

  function finish() {
    const sm = L.summary(life);
    show('life-end');
    $('end-title').textContent = sm.title;
    $('end-score').textContent = sm.score + ' / 100';
    $('end-farewell').textContent = lastResult && lastResult.say ? lastResult.say : '';
    $('end-line').textContent = life.name + ' ne ' + sm.ageAtEnd + ' saal ki zindagi guzari' + (sm.job ? ' (' + sm.job + ')' : '') + '.';
    const v = $('end-virtues'); v.textContent = '';
    if (!sm.virtues.length) v.appendChild(el('li', null, 'Is zindagi mein koi khaas khoobi numayan na ho saki. Agli baar behtar!'));
    sm.virtues.forEach((x) => v.appendChild(el('li', null, x.name + ' (' + x.value + ')')));
    const m = $('end-memories'); m.textContent = '';
    sm.memories.forEach((x) => {
      const li = el('li');
      li.appendChild(el('span', 'life-mem-icon', x.icon));
      li.appendChild(el('b', null, ' ' + x.age + ' saal: ' + x.title + '. '));
      li.appendChild(document.createTextNode(x.text));
      m.appendChild(li);
    });
    const s = $('end-stats'); s.textContent = '';
    ['health', 'knowledge', 'happiness', 'relations'].forEach((k) => s.appendChild(el('li', null, LABEL[k] + ': ' + life[k])));
    s.appendChild(el('li', null, 'Paisa: ' + L.fmtRs(life.money)));
    const cb = $('life-claim');
    if (meta && !life.flags.paid) { cb.hidden = false; cb.textContent = (I18 ? I18.t('machine.claim') : 'Points') + ' (+' + Meta.pointsFor(sm, life) + ')'; } else cb.hidden = true;
    $('end-meta').textContent = '';
  }
  $('life-claim').addEventListener('click', () => {
    const r = Meta.claim(meta, life, L); if (!r.gained) return;
    saveMeta(); autosave(); $('life-claim').hidden = true;
    $('end-meta').textContent = '+' + r.gained + ' Time Machine points (' + meta.points + ')';
  });
  $('life-submit').addEventListener('click', async () => {
    const out = $('end-meta');
    if (document.body.dataset.auth !== '1') { out.textContent = I18 ? I18.t('board.login') : 'Login'; return; }
    try {
      const r = await fetch('/api/life-score', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-csrf-token': document.body.dataset.csrf || '' }, body: JSON.stringify({ life }) });
      const j = await r.json(); out.textContent = r.ok ? 'Score ' + j.score + (j.improved ? ' - leaderboard par naya best!' : ' - aap ka best ' + j.best + ' hai') : (j.error || 'Score nahi ja saka');
    } catch (e) { out.textContent = 'Score nahi ja saka'; }
  });

  function begin(e) {
    e.preventDefault();
    life = L.create({ name: $('life-name').value, era: $('life-era').value, dream: $('life-dream').value || null, perks: meta ? meta.perks : [] });
    lastResult = null;
    show('life-play');
    render();
    autosave();
  }

  $('life-form').addEventListener('submit', begin);
  $('life-next').addEventListener('click', () => { lastResult = null; L.advance(life); render(); autosave(); });
  $('life-restart').addEventListener('click', () => { if (confirm('Naya jeevan shuru karne se mojooda save ki hui zindagi mit jayegi. Pakka?')) fresh(); });
  $('life-restart2').addEventListener('click', fresh);
  const movie = () => { if (window.TimeWarpMovie && life) window.TimeWarpMovie.open(life); };
  $('life-movie').addEventListener('click', movie);
  $('life-movie-mid').addEventListener('click', () => { if (life && life.memories.length) movie(); else $('life-saved').textContent = 'Abhi film ke liye yaadein kam hain.'; });
  $('life-new-btn').addEventListener('click', fresh);
  show('life-start');

  // On load: ?new=1 (home "New Life") starts clean, ?continue=1 (home "Continue") resumes at once, otherwise a Continue card is offered.
  (async function init() {
    fillStart();
    if (!Save) return;
    const q = new URLSearchParams(location.search);
    if (q.get('new') === '1') { await Save.clear('life'); return; }
    const sv = await Save.load();
    if (sv && sv.meta && Meta) { meta = Meta.sanitize(sv.meta, L.PERKS); if (I18 && meta.lang && !localStorage.getItem('timewarp-lang')) I18.setLang(meta.lang, true); fillStart(); }
    const saved = sv && L.restore(sv.life);
    if (!saved) return;
    $('life-continue-btn').addEventListener('click', () => resume(saved));
    if (q.get('continue') === '1') { resume(saved); return; }
    $('life-continue-text').textContent = describe(saved);
    $('life-continue').hidden = false;
  })();
})();
