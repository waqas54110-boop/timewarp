// TimeWarp Adventures: shared screen parts (state in the browser, coin / basket / fossil bar, messages).
// Load order on every Adventures page: adv.js, farm.js, detective.js, dino.js, adv-ui.js, then the page's own file.
(function () {
  'use strict';
  const mods = { Farm: window.TimeWarpFarm, Detective: window.TimeWarpDetective, Dino: window.TimeWarpDino };
  const memory = {};
  const storage = (() => { try { const s = window.localStorage; s.getItem('x'); return s; } catch (e) { return { getItem: (k) => memory[k] || null, setItem: (k, v) => { memory[k] = v; } }; } })();
  const adv = window.TimeWarpAdv.load(storage, mods);
  const bar = document.getElementById('adv-wallet'), msg = document.getElementById('adv-msg');

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function save() { return window.TimeWarpAdv.save(storage, adv); }
  function say(text, bad) { if (!msg) return; msg.textContent = text || ''; msg.className = 'adv-msg' + (bad ? ' bad' : ''); }
  function wallet() {
    if (!bar) return;
    const parts = [el('span', 'adv-coin', '💰 Rs ' + adv.wallet.coins)];
    const crops = Object.keys(adv.wallet.basket).map((id) => { const c = mods.Farm.BY[id]; return c ? c.icon + '×' + adv.wallet.basket[id] : ''; }).filter(Boolean);
    const fos = Object.keys(adv.wallet.fossils).map((id) => { const f = mods.Dino.FOSSILS.find((q) => q.id === id); return f ? f.icon + '×' + adv.wallet.fossils[id] : ''; }).filter(Boolean);
    parts.push(el('span', 'adv-basket', '🧺 ' + (crops.length ? crops.join(' ') : 'khali')));
    parts.push(el('span', 'adv-fossils', '🦴 ' + (fos.length ? fos.join(' ') : 'koi fossil nahi')));
    bar.replaceChildren(...parts);
  }
  function commit(res) { if (res && res.say) say(res.say, res.ok === false); if (res && res.ok === false && res.why) say(res.why, true); save(); wallet(); }
  window.AdvUI = { adv, mods, el, save, say, wallet, commit };
  wallet();
  addEventListener('pagehide', save);
})();
