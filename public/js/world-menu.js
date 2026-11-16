// Live World on a phone: the top buttons and the mission card live behind one "Menu" button.
(function () {
  const root = document.getElementById('world'), top = root && root.querySelector('.explore-top');
  if (!root || !top) return;
  const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'menu-btn'; btn.className = 'btn menu-btn keep';
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'menu-mission-slot');
  const label = document.createElement('span'); label.textContent = '\u2630 Menu'; const dot = document.createElement('i'); dot.className = 'menu-dot'; dot.hidden = true; btn.append(label, dot);
  const slot = document.createElement('div'); slot.id = 'menu-mission-slot'; slot.className = 'menu-mission-slot keep'; slot.hidden = true;
  const title = top.querySelector('.explore-title'); top.insertBefore(btn, title ? title.nextSibling : null); top.insertBefore(slot, btn.nextSibling);
  let open = false;
  const mission = () => root.querySelector('.mission');
  function set(v) {
    open = v; root.classList.toggle('menu-open', v); btn.setAttribute('aria-expanded', String(v)); label.textContent = v ? '\u2715 Close menu' : '\u2630 Menu';
    const m = mission(); slot.hidden = !v;
    if (v && m) { const h = document.createElement('strong'); h.className = 'slot-head'; h.textContent = '\uD83C\uDFAF Your mission'; slot.replaceChildren(h, m); dot.hidden = true; }
    else if (!v && m && m.parentNode === slot) { root.appendChild(m); slot.replaceChildren(); }
  }
  btn.addEventListener('click', () => set(!open));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) set(false); });
  const canvas = document.getElementById('world-canvas'); if (canvas) canvas.addEventListener('pointerdown', () => { if (open) set(false); });
  top.addEventListener('click', (e) => { const b = e.target.closest('button,a'); if (open && b && b !== btn && !b.classList.contains('m-skip') && !b.closest('.menu-mission-slot') && b.id !== 'paint-color') setTimeout(() => set(false), 120); });
  // a small dot on the Menu button when the mission changes while the menu is closed
  let last = ''; setInterval(() => { const m = mission(); if (!m || open) return; const t = (m.querySelector('.m-title') || {}).textContent || ''; if (last && t && t !== last) dot.hidden = false; if (t) last = t; }, 1000);
})();
