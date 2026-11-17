// Dinosaur Era screen: draws the map, reads keys / touch buttons, shows the camp (egg, pet, feeding). Rules are in dino.js (tested).
(function () {
  'use strict';
  const { adv, mods, el, commit, say } = window.AdvUI, Dino = mods.Dino, Farm = mods.Farm;
  const canvas = document.getElementById('dino-canvas'), ctx = canvas.getContext('2d'), camp = document.getElementById('dino-camp'), stat = document.getElementById('dino-stat');
  const T = 40; canvas.width = Dino.W * T; canvas.height = Dino.H * T;
  let run = Dino.newRun(adv, null), held = null, last = performance.now(), saveAt = 0;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const GROUND = { '.': '#7fb05a', b: '#6aa04c', C: '#c9a66b', E: '#7fb05a', f: '#7fb05a', T: '#2f6b3a', '~': '#3b82c4' };
  function glyph(ch, x, y, size, alpha) { ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.font = (size || 28) + 'px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x * T + T / 2, y * T + T / 2 + 2); ctx.globalAlpha = 1; }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < Dino.H; y++) for (let x = 0; x < Dino.W; x++) {
      const ch = Dino.at(x, y); ctx.fillStyle = GROUND[ch] || GROUND['.']; ctx.fillRect(x * T, y * T, T, T);
      if ((x + y) % 2 === 0 && ch !== '~' && ch !== 'T') { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x * T, y * T, T, T); }
      if (ch === 'T') glyph('🌲', x, y); else if (ch === '~') glyph('🌊', x, y, 26); else if (ch === 'b') glyph('🌿', x, y, 26); else if (ch === 'C') glyph('🏕️', x, y);
    }
    if (run.egg) glyph('🥚', run.egg.x, run.egg.y, 26);
    else if (adv.dino.egg === 'nest') glyph('🪺', Dino.NEST.x, Dino.NEST.y, 26);
    Dino.hints(run, adv).forEach((f) => glyph('💨', f.x, f.y, 22, 0.8));
    const pet = adv.dino.pet;
    if (pet && (run.prev.x !== run.x || run.prev.y !== run.y)) glyph(Dino.KIND_BY[pet.kind].icon, run.prev.x, run.prev.y, 22 + Dino.petLevel(pet) * 2);
    run.dinos.forEach((d) => glyph(d.kind === 'rex' ? '🦖' : '🦕', d.x, d.y, d.kind === 'rex' ? 32 : 30, d.sulk > 0 ? 0.55 : 1));
    const hiding = Dino.at(run.x, run.y) === 'b';
    glyph('🧑‍🔬', run.x, run.y, 28, hiding ? 0.6 : 1);
    if (run.carry) glyph('🥚', run.x, run.y - 0.55, 18);
    if (run.dinos.some((d) => d.kind === 'rex' && d.mode === 'chase' && d.sulk <= 0)) { ctx.fillStyle = 'rgba(220,38,38,.18)'; ctx.fillRect(0, 0, canvas.width, canvas.height); glyph('❗', run.x, run.y - 0.9, 20); }
  }
  function drawCamp() {
    camp.replaceChildren();
    const d = adv.dino, pet = d.pet;
    camp.append(el('h3', null, '⛺ Camp'));
    if (pet) {
      const k = Dino.KIND_BY[pet.kind], lvl = Dino.petLevel(pet), next = Dino.LEVEL_XP[lvl];
      camp.append(el('p', 'dino-pet', k.icon + ' ' + pet.name + ' · Level ' + lvl + (next ? ' (' + pet.xp + '/' + next + ' xp)' : ' (sab se bara!)')));
      camp.append(el('p', 'small muted', ({ 1: 'Level 2: fossil ki khushbu 4 qadam door tak.', 2: 'Level 3: poore nakshe ke fossil dhoondta hai.', 3: 'Level 4: Rex sirf 3 qadam par dekh pata hai.', 4: 'Aap ka dino poori tarah bara ho gaya!' })[lvl]));
      const nameRow = el('div', 'adv-row'), inp = el('input'); inp.maxLength = 16; inp.value = pet.name; inp.setAttribute('aria-label', 'Pet ka naam');
      const rb = el('button', 'btn small', 'Naam badlo'); rb.type = 'button'; rb.addEventListener('click', () => { commit(Dino.rename(adv, inp.value)); drawCamp(); });
      nameRow.append(inp, rb); camp.append(nameRow);
      const ids = Object.keys(adv.wallet.basket);
      camp.append(el('p', 'small', ids.length ? 'Time Farm ki tokri se khilayein:' : 'Tokri khali hai. Time Farm mein fasal ugayein aur yahan khilayein.'));
      const row = el('div', 'adv-row');
      ids.forEach((id) => { const c = Farm.BY[id]; const b = el('button', 'btn small', c.icon + ' ' + c.name + ' ×' + adv.wallet.basket[id]); b.type = 'button'; b.addEventListener('click', () => { commit(Dino.feed(adv, id, c.sell)); drawCamp(); }); row.append(b); });
      camp.append(row);
      if (!ids.length) { const a = el('a', 'btn small', '🌾 Time Farm'); a.href = /\.html$/.test(location.pathname) ? '/farm.html' : '/farm'; camp.append(a); }
    } else if (d.egg === 'camp') {
      camp.append(el('p', null, '🥚 Anda camp mein hai. ' + Dino.HATCH_COST + ' fossils se garam karein (aap ke paas: ' + Dino.fossilCount(adv) + ').'));
      const b = el('button', 'btn primary', '🔥 Anda garam karo'); b.type = 'button'; b.addEventListener('click', () => { commit(Dino.hatch(run, adv)); drawCamp(); }); camp.append(b);
    } else camp.append(el('p', null, '🪺 Nest mein ek anda hai (nakshe ke neeche daayen). Bade Rex se bach kar use utha kar camp tak laayen. Dig/anda uthane ke liye E dabayein.'));
    stat.textContent = 'Safar: ' + d.trips + ' · khudaai: ' + d.dug + ' · dino ne daraya: ' + d.scares + ' · is safar mein fossils: ' + run.fos.filter((f) => f.dug).length + '/' + run.fos.length;
  }
  function handle(events) {
    events.forEach((e) => { say(e.say); if (e.type === 'caught' || e.type === 'egg-home') { drawCamp(); commit(); } });
  }
  function step(dx, dy) { const r = Dino.move(run, adv, dx, dy); if (r.moved && r.events.length) handle(r.events); }
  function dig() {
    const r = Dino.act(run, adv); commit(r);
    if (r.tripDone) { run = Dino.newRun(adv, null); }
    drawCamp();
  }
  const KEYS = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
  addEventListener('keydown', (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    const k = KEYS[e.key] || KEYS[e.key.toLowerCase && e.key.toLowerCase()];
    if (k) { held = k; e.preventDefault(); return; }
    if (e.key === 'e' || e.key === 'E' || e.key === ' ') { e.preventDefault(); dig(); }
  });
  addEventListener('keyup', (e) => { const k = KEYS[e.key] || KEYS[e.key.toLowerCase && e.key.toLowerCase()]; if (k && held === k) held = null; });
  document.querySelectorAll('[data-dir]').forEach((b) => {
    const d = b.dataset.dir.split(',').map(Number);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); held = d; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => b.addEventListener(n, () => { if (held === d || (held && held[0] === d[0] && held[1] === d[1])) held = null; }));
  });
  document.getElementById('dino-dig').addEventListener('click', dig);
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!document.hidden) {
      if (held) step(held[0], held[1]);
      handle(Dino.tick(run, adv, dt));
      draw();
      if (now - saveAt > 8000) { saveAt = now; window.AdvUI.save(); }
    }
    requestAnimationFrame(loop);
  }
  if (reduce) say('Tip: animation kam karne ki setting on hai, dino phir bhi chalenge.');
  drawCamp(); window.AdvUI.wallet(); requestAnimationFrame(loop);
})();
