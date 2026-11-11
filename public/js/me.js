// "Meri Duniya": the page around the saved life - home and things, pets, family tree, diary, dreams, Time Capsule,
// Butterfly Effect, Time Machine garage, leaderboard and settings. Everything is written with textContent (no innerHTML).
(function () {
  'use strict';
  const L = window.TimeWarpLife, Meta = window.TimeWarpMeta, Save = window.TimeWarpSave, I = window.TimeWarpI18n;
  const $ = (id) => document.getElementById(id);
  const t = (k) => (I ? I.t(k) : k);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const auth = document.body.dataset.auth === '1';
  let life = null, meta = Meta.fresh(), serverSave = null, tab = 'home';
  const say = (m) => { $('me-msg').textContent = m || ''; };
  const saveLife = () => Save.save('life', life);
  const saveMeta = () => { meta.lang = I ? I.lang : meta.lang; Save.save('meta', meta); };
  const TABS = ['home', 'family', 'diary', 'dreams', 'capsule', 'butterfly', 'machine', 'board', 'settings'];

  function btn(label, fn, cls) { const b = el('button', 'btn ' + (cls || 'small'), label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function doAct(kind, id, extra) { const r = L.act(life, kind, id, extra); say(r.ok ? r.say : r.why); if (r.ok) { saveLife(); draw(); } return r; }

  function fxText(fx) { const n = { health: 'sehat', knowledge: 'ilm', happiness: 'khushi', relations: 'rishtay' }; return Object.keys(fx || {}).map((k) => '+' + fx[k] + ' ' + (n[k] || k)).join(', '); }

  const views = {
    home(p) {
      const h = L.HOMES.find((x) => x.id === life.home) || L.HOMES[0];
      p.append(el('h3', null, t('home.current') + ': ' + h.icon + ' ' + h.name), el('p', 'small muted', 'Jagah: ' + h.slots + ' cheezein ' + (fxText(h.fx) ? ' · ' + fxText(h.fx) + ' har saal' : '')));
      p.append(el('h4', null, t('home.upgrade')));
      const g = el('div', 'me-grid');
      L.HOMES.forEach((x) => { const c = el('div', 'me-card' + (x.id === life.home ? ' owned' : '')); c.append(el('h4', null, x.icon + ' ' + x.name), el('p', 'small', L.fmtRs(L.price(life, x.cost)))); if (x.id !== life.home) c.append(btn(t('buy'), () => doAct('home', x.id))); g.append(c); });
      p.append(g, el('h3', null, t('home.things')));
      const g2 = el('div', 'me-grid');
      L.ITEMS.forEach((x) => { const own = life.items.includes(x.id); const c = el('div', 'me-card' + (own ? ' owned' : '')); c.append(el('h4', null, x.icon + ' ' + x.name), el('p', 'small', L.fmtRs(L.price(life, x.cost)) + (fxText(x.fx) ? ' · ' + fxText(x.fx) : ''))); c.append(own ? btn(t('sell'), () => doAct('sell', x.id), 'ghost small') : btn(t('buy'), () => doAct('item', x.id))); g2.append(c); });
      p.append(g2, el('h3', null, t('home.pets')));
      const g3 = el('div', 'me-grid');
      life.pets.forEach((x) => { const d = L.PETS.find((q) => q.id === x.id); const c = el('div', 'me-card owned'); c.append(el('h4', null, d.icon + ' ' + d.name), el('p', 'small', t('owned') + ' (' + x.since + ' saal ki umar se)')); g3.append(c); });
      L.PETS.forEach((x) => { const c = el('div', 'me-card'); c.append(el('h4', null, x.icon + ' ' + x.name), el('p', 'small', L.fmtRs(L.price(life, x.cost)) + (fxText(x.fx) ? ' · ' + fxText(x.fx) : ''))); c.append(btn(t('adopt'), () => doAct('pet', x.id))); g3.append(c); });
      p.append(g3);
    },
    family(p) {
      const nodes = L.familyTree(life), gens = [...new Set(nodes.map((n) => n.gen))].sort((a, b) => a - b);
      gens.forEach((gn) => { const ul = el('ul', 'me-tree'); nodes.filter((n) => n.gen === gn).forEach((n) => ul.append(el('li', null, n.icon + ' ' + n.label + (n.me ? ' (aap)' : '')))); p.append(ul); });
    },
    diary(p) {
      const f = el('form'); const ta = el('textarea', 'me-wide'); ta.maxLength = 240; ta.setAttribute('aria-label', t('diary.add'));
      f.append(el('label', null, t('diary.add')), ta, btn(t('save'), () => { if (L.addDiary(life, ta.value)) { saveLife(); draw(); } }, 'primary'));
      f.addEventListener('submit', (e) => e.preventDefault()); p.append(f);
      const ul = el('ul', 'me-diary');
      L.diaryEntries(life).forEach((d) => { const li = el('li'); li.append(el('b', null, d.icon + ' ' + d.age + ' - ' + d.title + ': '), document.createTextNode(d.text)); ul.append(li); });
      p.append(ul);
    },
    dreams(p) {
      p.append(el('p', 'small muted', life.dream ? 'Aap ka khwab: ' + (L.DREAMS.find((d) => d.id === life.dream) || {}).label : t('dream.none')));
      const ul = el('ul', 'me-diary'); L.goals(life).forEach((g) => ul.append(el('li', null, (g.done ? '✅ ' : '⬜ ') + g.label + (g.dream ? ' ⭐' : '')))); p.append(ul);
    },
    capsule(p) {
      if (life.capsule) { p.append(el('p', null, '⏳ ' + (life.capsule.opened ? 'Khul chuka hai: ' : life.capsule.open + ' saal ki umar mein khulega. ') + (life.capsule.opened ? life.capsule.text : ''))); return; }
      const ta = el('textarea', 'me-wide'); ta.maxLength = 400; ta.setAttribute('aria-label', t('capsule.text'));
      const yrs = el('input'); yrs.type = 'number'; yrs.min = 3; yrs.max = 60; yrs.value = 10; yrs.setAttribute('aria-label', t('capsule.years'));
      p.append(el('label', null, t('capsule.text')), ta, el('label', null, t('capsule.years')), yrs, btn(t('capsule.seal'), () => doAct('capsule', 'x', { text: ta.value, years: yrs.value }), 'primary'));
    },
    butterfly(p) {
      p.append(el('p', null, t('butterfly.lead')));
      const alts = L.alternatives(life);
      if (!alts.length) { p.append(el('p', 'muted', 'Is zindagi mein replay ki history nahi (purani save). Nayi zindagi mein ye chalega.')); return; }
      const out = el('div', 'me-card'); out.hidden = true;
      alts.forEach((a) => {
        const c = el('div', 'me-card'); c.append(el('h4', null, a.icon + ' ' + a.age + ' saal: ' + a.title));
        a.options.filter((o) => o.id !== a.chosen).forEach((o) => c.append(btn(t('butterfly.try') + ': ' + o.label, () => {
          const r = L.whatIf(life, a.i, o.id), c2 = r.cmp; out.hidden = false; out.textContent = '';
          const row = (n, k) => out.append(el('p', 'small', n + ': ' + c2[k][0] + '  →  ' + c2[k][1]));
          out.append(el('h4', null, 'Agar aap ne "' + o.label + '" chuna hota'));
          row('Score', 'score'); row('Umar', 'age'); row('Paisa', 'money'); row('Sehat', 'health'); row('Khushi', 'happiness'); row('Peshah', 'job'); row('Shadi', 'married'); row('Bachay', 'children');
        }, 'ghost small')));
        p.append(c);
      });
      p.append(out);
    },
    machine(p) {
      p.append(el('h3', null, '⚙️ ' + t('machine.points') + ': ' + meta.points));
      if (life.over && !life.flags.paid) p.append(btn(t('machine.claim') + ' (+' + Meta.pointsFor(L.summary(life), life) + ')', () => { const r = Meta.claim(meta, life, L); if (r.gained) { saveMeta(); saveLife(); say('+' + r.gained); draw(); } }, 'primary'));
      const g = el('div', 'me-grid');
      Object.keys(L.PERKS).forEach((id) => { const k = L.PERKS[id], own = meta.perks.includes(id); const c = el('div', 'me-card' + (own ? ' owned' : '')); c.append(el('h4', null, k.icon + ' ' + k.name), el('p', 'small', k.desc + ' · ' + k.cost + ' pts'));
        c.append(own ? el('p', 'small', '✅ ' + t('owned')) : btn(t('buy'), () => { const r = Meta.buy(meta, id, L.PERKS); say(r.ok ? k.name : r.why); if (r.ok) { saveMeta(); draw(); } })); g.append(c); });
      p.append(g);
    },
    async board(p) {
      if (!auth) p.append(el('p', 'muted', t('board.login')));
      const tb = el('table', 'me-board'); p.append(tb);
      try {
        const r = await fetch('/api/life-scores', { headers: { Accept: 'application/json' } }), j = await r.json();
        const hd = el('tr'); ['#', 'Naam', 'Score', 'Umar', 'Peshah'].forEach((h) => hd.append(el('th', null, h))); tb.append(hd);
        (j.scores || []).forEach((s, i) => { const tr = el('tr'); [i + 1, s.name, s.score + ' - ' + s.title, s.age, s.job || '-'].forEach((v) => tr.append(el('td', null, String(v)))); tb.append(tr); });
        if (!(j.scores || []).length) p.append(el('p', 'muted', 'Abhi koi score nahi. Zindagi mukammal karke pehle banein!'));
      } catch (e) { p.append(el('p', 'muted', 'Leaderboard abhi nahi khul saka.')); }
      if (auth && life.over) p.append(btn(t('board.submit'), async () => {
        try { const r = await fetch('/api/life-score', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-csrf-token': document.body.dataset.csrf || '' }, body: JSON.stringify({ life }) }); const j = await r.json(); say(r.ok ? 'Score ' + j.score : j.error); if (r.ok) draw(); } catch (e) { say('Score nahi ja saka'); }
      }, 'primary'));
    },
    settings(p) {
      p.append(el('h4', null, t('lang')));
      const sel = el('select'); sel.setAttribute('aria-label', t('lang')); Object.keys(I.LANGS).forEach((k) => { const o = el('option', null, I.LANGS[k]); o.value = k; sel.append(o); }); sel.value = I.lang;
      sel.addEventListener('change', () => { I.setLang(sel.value); saveMeta(); }); p.append(sel);
      p.append(el('h4', null, 'Save file'));
      p.append(btn(t('export'), () => {
        const blob = new Blob([Save.exportJson({ life, meta, world: null })], { type: 'application/json' }); const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'timewarp-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }));
      const file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.setAttribute('aria-label', t('import'));
      file.addEventListener('change', async () => {
        const f = file.files[0]; if (!f || f.size > 400000) { say('File bohat bari ya khali hai'); return; }
        const d = Save.parseJson(await f.text()); const nl = d && d.life ? L.restore(d.life) : null;
        if (!d || (!nl && !d.meta)) { say('Ye TimeWarp save file nahi lagti'); return; }
        if (nl) { life = nl; await saveLife(); }
        if (d.meta) { meta = Meta.sanitize(d.meta, L.PERKS); await saveMeta(); }
        say('Save file khul gayi'); draw();
      });
      p.append(el('label', null, t('import')), file);
      if (auth && Save.local()) p.append(btn(t('upload.local'), async () => { const m = await Save.adopt(serverSave); say(m.length ? m.join(', ') + ' ✔ - page dobara kholein' : 'Account mein pehle se save hai, kuch nahi badla'); }));
    },
  };

  async function draw() {
    if (!life) return;
    const sm = L.summary(life); $('me-sum').textContent = life.name + ' · ' + life.age + ' ' + t('age.unit') + ' · ' + L.fmtRs(life.money);
    const tabs = $('me-tabs'); tabs.textContent = '';
    TABS.forEach((k) => { const b = el('button', 'btn ghost small', t('tab.' + k)); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(k === tab)); b.addEventListener('click', () => { tab = k; say(''); draw(); }); tabs.append(b); });
    const p = $('me-panel'); p.textContent = ''; await views[tab](p);
  }
  if (I) I.onChange(() => { draw(); });

  (async function init() {
    const sv = await Save.load(); serverSave = sv;
    if (sv && sv.meta) { meta = Meta.sanitize(sv.meta, L.PERKS); if (!localStorage.getItem('timewarp-lang') && I && meta.lang) I.setLang(meta.lang, true); }
    life = sv && L.restore(sv.life);
    if (!life) { $('me-nolife').hidden = false; if (auth && Save.local()) { $('me-nolife').append(btn(t('upload.local'), async () => { const m = await Save.adopt(serverSave); say(m.length ? m.join(', ') + ' ✔' : ''); if (m.length) location.reload(); }, 'primary')); } return; }
    $('me-main').hidden = false; draw();
  })();
})();
