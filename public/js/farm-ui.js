// Time Farm screen. All rules are in farm.js (tested); this file only draws and forwards clicks.
(function () {
  'use strict';
  const { adv, mods, el, commit } = window.AdvUI, Farm = mods.Farm, root = document.getElementById('farm');
  const grid = document.getElementById('farm-grid'), eraBar = document.getElementById('farm-eras'), panel = document.getElementById('farm-panel'), market = document.getElementById('farm-market'), info = document.getElementById('farm-info');
  let sel = -1;

  const STATE_ICON = { empty: '🟫', rotten: '🥀' };
  function plotLabel(i) {
    const p = adv.farm.plots[i], st = Farm.status(adv.farm, i);
    if (!p) return 'Khali plot ' + (i + 1);
    const c = Farm.BY[p.crop];
    return c.name + ': ' + ({ growing: 'ugh rahi hai', ripe: 'tayyar', rotten: 'kharab' })[st] + ' (plot ' + (i + 1) + ')';
  }
  function drawGrid() {
    grid.replaceChildren();
    adv.farm.plots.forEach((p, i) => {
      const st = Farm.status(adv.farm, i), b = el('button', 'plot ' + st + (i === sel ? ' sel' : ''));
      b.type = 'button'; b.setAttribute('aria-label', plotLabel(i)); b.setAttribute('aria-pressed', String(i === sel));
      const icon = el('span', 'plot-icon', st === 'empty' || st === 'rotten' ? STATE_ICON[st] : Farm.BY[p.crop].icon);
      if (st === 'growing') icon.classList.add('grow');
      b.append(icon);
      if (p) {
        const c = Farm.BY[p.crop];
        b.append(el('span', 'plot-tag', st === 'growing' ? (c.minSteps ? 'waqt ka intezar' : p.days + '/' + c.days + ' din') : st === 'ripe' ? 'tayyar!' : 'kharab'));
        if (p.wat.length) b.append(el('span', 'plot-wet', '💧'.repeat(p.wat.length)));
      } else b.append(el('span', 'plot-tag', 'khali'));
      b.addEventListener('click', () => { sel = i; render(); });
      grid.append(b);
    });
  }
  function drawEras() {
    eraBar.replaceChildren();
    Farm.ERAS.forEach((e) => {
      const b = el('button', 'btn small' + (adv.farm.era === e ? ' primary' : ''), Farm.ERA_INFO[e].icon + ' ' + Farm.ERA_INFO[e].name);
      b.type = 'button'; b.setAttribute('aria-pressed', String(adv.farm.era === e));
      b.addEventListener('click', () => { const r = Farm.travel(adv, e); commit(r); render(); });
      eraBar.append(b);
    });
  }
  function act(name, cls, fn) { const b = el('button', 'btn small ' + (cls || ''), name); b.type = 'button'; b.addEventListener('click', () => { commit(fn()); render(); }); return b; }
  function drawPanel() {
    panel.replaceChildren();
    if (sel < 0) { panel.append(el('p', 'muted', 'Koi plot chunein: beej boyen, paani den ya fasal kaatein.')); return; }
    const p = adv.farm.plots[sel], st = Farm.status(adv.farm, sel);
    panel.append(el('h3', null, 'Plot ' + (sel + 1)));
    if (!p) {
      panel.append(el('p', 'small muted', 'Ye beej aaj ke zamane mein milte hain (Waqt ka phal har zamane mein):'));
      const row = el('div', 'adv-row');
      Farm.CROPS.filter((c) => c.era === adv.farm.era || c.era === 'any').forEach((c) => {
        const b = act(c.icon + ' ' + c.name + ' · Rs ' + c.seed, '', () => Farm.plant(adv, sel, c.id));
        b.title = c.minSteps ? 'Sirf 2 qadam waqt mein safar ke baad pakta hai, bohat qeemti' : c.days + ' din mein pakta hai; ' + (c.keeps === 0 ? 'waqt ke safar mein kharab ho jata hai' : c.keeps + ' qadam tak safar sah leta hai');
        row.append(b);
      });
      panel.append(row);
    } else {
      const c = Farm.BY[p.crop];
      panel.append(el('p', null, c.icon + ' ' + c.name + ' — ' + ({ growing: 'abhi ugh rahi hai', ripe: 'tayyar hai!', rotten: 'waqt ke safar mein kharab ho gayi' })[st]));
      panel.append(el('p', 'small muted', 'Safar ke qadam: ' + p.steps + ' (ye fasal ' + c.keeps + ' tak sah sakti hai)' + (c.minSteps ? ' · pakne ke liye kam az kam ' + c.minSteps + ' qadam' : '') + ' · paani: ' + (p.wat.length ? p.wat.map((e) => Farm.ERA_INFO[e].icon).join(' ') : 'abhi nahi')));
      const row = el('div', 'adv-row');
      if (st !== 'rotten') row.append(act('💧 Paani do', '', () => Farm.water(adv, sel)));
      if (st !== 'growing') row.append(act(st === 'rotten' ? '🧹 Saaf karo' : '🧺 Fasal kaato', st === 'ripe' ? 'primary' : '', () => Farm.harvest(adv, sel)));
      panel.append(row);
    }
  }
  function drawMarket() {
    market.replaceChildren();
    const ids = Object.keys(adv.wallet.basket);
    market.append(el('h3', null, '🛒 Mandi — ' + Farm.ERA_INFO[adv.farm.era].name));
    market.append(el('p', 'small muted', 'Future mein bhaav 1.5 guna, past mein 0.8 guna. Doosre zamane ki fasal par +25% nayab bonus.'));
    if (!ids.length) { market.append(el('p', 'muted', 'Tokri khali hai. Fasal kaat kar yahan bechein.')); return; }
    ids.forEach((id) => {
      const c = Farm.BY[id], row = el('div', 'adv-row');
      row.append(el('span', null, c.icon + ' ' + c.name + ' ×' + adv.wallet.basket[id] + ' · Rs ' + Farm.unitPrice(id, adv.farm.era) + ' har ek'));
      row.append(act('Ek becho', '', () => Farm.sell(adv, id, 1)));
      row.append(act('Sab becho', 'primary', () => Farm.sell(adv, id, 'all')));
      market.append(row);
    });
  }
  function render() {
    root.dataset.era = adv.farm.era;
    info.textContent = ERA_LINE[adv.farm.era] + ' · Din ' + adv.farm.day + ' · ' + adv.farm.harvested + ' fasal kaati';
    drawEras(); drawGrid(); drawPanel(); drawMarket(); window.AdvUI.wallet();
  }
  const ERA_LINE = { past: '🛖 1950 ka gaon: kachchi zameen, baarish har 3 din baad', present: '🏡 Aaj ka khet: tubewell ka paani', future: '🏙️ 2050: drone sprinkler, hydroponic tower' };
  document.getElementById('farm-day').addEventListener('click', () => { commit(Farm.nextDay(adv)); render(); });
  document.getElementById('farm-buy').addEventListener('click', () => { commit(Farm.buyPlot(adv)); render(); });
  render();
})();
