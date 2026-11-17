// Time Detective screen. Rules and cases are in detective.js (tested).
(function () {
  'use strict';
  const { adv, mods, el, commit, say } = window.AdvUI, Det = mods.Detective;
  const list = document.getElementById('det-list'), play = document.getElementById('det-play'), head = document.getElementById('det-head'), scene = document.getElementById('det-scene'),
    asks = document.getElementById('det-asks'), log = document.getElementById('det-log'), result = document.getElementById('det-result'), rankEl = document.getElementById('det-rank');
  let c = null, s = null, picked = null;
  const ERA_ICON = { past: '🛖', present: '🏙️', future: '🛸' };
  const stars = (n) => '★'.repeat(n || 0) + '☆'.repeat(3 - (n || 0));

  function drawList() {
    list.replaceChildren();
    const ids = Det.CASE_IDS.slice();
    const day = Math.floor(Date.now() / 86400000), daily = Det.dailyCase(day);
    const mk = (id, label) => {
      const cs = Det.getCase(id), b = el('button', 'det-case'); b.type = 'button';
      b.append(el('strong', null, label), el('span', 'small', ERA_ICON[cs.era] + ' ' + cs.title), el('span', 'det-stars', stars(adv.det.stars[id])));
      b.addEventListener('click', () => start(id)); return b;
    };
    list.append(mk(daily.id, '📅 Aaj ka case'));
    ids.forEach((id, i) => list.append(mk(id, 'Case ' + (i + 1))));
    rankEl.textContent = 'Aap ka darja: ' + Det.rank(adv) + ' · ' + Det.totalStars(adv) + ' sitare';
  }
  function start(id) {
    c = Det.getCase(id); s = Det.newSession(c); picked = null;
    list.hidden = true; play.hidden = false; result.hidden = true; result.replaceChildren(); log.replaceChildren();
    head.replaceChildren(el('h2', null, ERA_ICON[c.era] + ' ' + c.title), el('p', 'lead', c.intro), el('p', 'small muted', 'Sawal poochein, jo cheez clues se mel na khaye wo dhundli ho jaati hai. Kam sawal = zyada sitare. 3 galat ishare = case khatam.'));
    render();
  }
  function render() {
    const cand = Det.candidates(c, s);
    scene.replaceChildren();
    c.items.forEach((it) => {
      const b = el('button', 'det-item' + (cand.includes(it.id) ? '' : ' out') + (picked === it.id ? ' sel' : '')); b.type = 'button'; b.disabled = s.over;
      b.setAttribute('aria-pressed', String(picked === it.id));
      b.append(el('span', 'det-icon', it.icon), el('span', 'det-name', it.name));
      if (s.over) { if (it.id === c.glitch) b.classList.add('glitch'); b.append(el('span', 'det-attrs small', Object.values(it.attrs).join(' · '))); }
      b.addEventListener('click', () => { picked = it.id; render(); });
      scene.append(b);
    });
    asks.replaceChildren();
    Det.ATTRS.forEach((q) => { const b = el('button', 'btn small', Det.ASK[q].label); b.type = 'button'; b.disabled = s.over || s.asked.includes(q); b.addEventListener('click', () => ask(q)); asks.append(b); });
    const r = el('button', 'btn small ghost', '👂 Gali ki afwah sunein'); r.type = 'button'; r.disabled = s.over || s.rumourAsked; r.addEventListener('click', () => ask('rumour')); asks.append(r);
    const go = el('button', 'btn small primary', picked ? '👉 Yehi time glitch hai!' : 'Pehle koi cheez chunein'); go.type = 'button'; go.disabled = s.over || !picked;
    go.addEventListener('click', accuse); asks.append(go);
    const back = el('button', 'btn small ghost', '← Cases'); back.type = 'button'; back.addEventListener('click', () => { play.hidden = true; list.hidden = false; drawList(); window.AdvUI.wallet(); }); asks.append(back);
  }
  function ask(q) {
    const r = Det.ask(c, s, q); if (!r.ok) { say(r.why, true); return; }
    const li = el('li', r.rumour ? 'rumour' : ''); li.append(el('strong', null, r.who + ': '), document.createTextNode(r.text)); log.append(li); render();
  }
  function accuse() {
    const r = Det.accuse(adv, c, s, picked); commit(r); picked = null;
    if (r.over) {
      result.hidden = false; result.replaceChildren(el('h3', null, r.right ? '🎉 ' + r.say : '😮 ' + r.say));
      if (r.right) result.append(el('p', null, stars(r.stars) + ' · ' + (r.coins ? '+Rs ' + r.coins : 'is case mein koi naya sitara nahi')));
      const g = c.items.find((i) => i.id === c.glitch); result.append(el('p', 'small muted', 'Time glitch: ' + g.icon + ' ' + g.name));
      const again = el('button', 'btn small', '🔁 Dobara khelein'); again.type = 'button'; again.addEventListener('click', () => start(c.id)); result.append(again);
    }
    render();
  }
  drawList();
})();
