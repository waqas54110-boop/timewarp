(() => {
  const csrf = document.body.dataset.csrf;
  const $ = (s, r = document) => r.querySelector(s);
  const currentYear = Number($('#hero')?.dataset.year) || new Date().getFullYear();

  // Installable app (PWA): the service worker needs https (or localhost); the install button appears when the browser allows it
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  const installBtn = $('#install-app');
  let installEvent = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; if (installBtn) installBtn.hidden = false; });
  installBtn?.addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt(); await installEvent.userChoice; installEvent = null; installBtn.hidden = true;
  });
  addEventListener('appinstalled', () => { if (installBtn) installBtn.hidden = true; });

  // Mobile nav
  const toggle = $('.nav-toggle');
  toggle?.addEventListener('click', () => {
    const open = $('#nav').classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  // Confirm dialogs (inline handlers are blocked by CSP)
  document.addEventListener('submit', (e) => {
    const msg = e.target.dataset?.confirm;
    if (msg && !confirm(msg)) e.preventDefault();
  });

  // ---------- Time-travel form ----------
  const form = $('#warp-form');
  if (form) {
    const year = $('#year');
    const err = $('#warp-error');
    const defaults = { past: 1947, future: 2050, present: currentYear };
    const setMode = (mode) => {
      document.body.dataset.mode = mode;
      if (mode === 'present') { year.value = currentYear; year.readOnly = true; }
      else {
        year.readOnly = false;
        if (mode === 'past') { year.max = currentYear - 1; year.min = -5000; if (Number(year.value) >= currentYear) year.value = defaults.past; }
        else { year.min = currentYear + 1; year.max = 3000; if (Number(year.value) <= currentYear) year.value = defaults.future; }
      }
      document.dispatchEvent(new CustomEvent('timewarp:mode', { detail: mode }));
    };
    form.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => setMode(r.value)));
    setMode(form.mode.value);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const mode = form.mode.value;
      const y = parseInt(year.value, 10);
      let msg = '';
      if (!Number.isInteger(y)) msg = 'Enter a valid year.';
      else if (mode === 'past' && (y < -5000 || y >= currentYear)) msg = `Past years must be between -5000 and ${currentYear - 1}.`;
      else if (mode === 'future' && (y <= currentYear || y > 3000)) msg = `Future years must be between ${currentYear + 1} and 3000.`;
      err.hidden = !msg; err.textContent = msg;
      if (msg) return;
      const qs = new URLSearchParams({ mode, year: y });
      if ($('#destination').value) qs.set('destinationId', $('#destination').value);
      const go = () => { location.href = '/travel?' + qs; };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return go();
      document.body.classList.add('warping');
      document.dispatchEvent(new CustomEvent('timewarp:warp'));
      setTimeout(go, 1300);
    });
  }

  // ---------- Save journey ----------
  const save = $('#save-journey');
  save?.addEventListener('click', async () => {
    const d = $('#journey').dataset;
    const status = $('#save-status');
    const body = { selectedYear: Number(d.year), travelType: d.mode };
    if (d.destination) body.destinationId = Number(d.destination);
    save.disabled = true;
    try {
      const r = await fetch('/api/journeys', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify(body) });
      status.textContent = r.ok ? 'Saved to your journeys ✓' : 'Could not save. Please try again.';
    } catch { status.textContent = 'Network error.'; }
    save.disabled = false;
  });

  // ---------- Delete journey ----------
  document.querySelectorAll('.delete-journey').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this journey?')) return;
    const r = await fetch('/api/journeys/' + b.dataset.id, { method: 'DELETE', headers: { 'x-csrf-token': csrf } });
    if (r.ok) b.closest('.card').remove();
  }));

  // ---------- Quiz ----------
  const quiz = $('#quiz');
  if (quiz) {
    const body = $('#quiz-body');
    const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); kids.forEach((k) => n.append(k)); return n; };
    $('#quiz-start').addEventListener('click', async () => {
      const diff = $('#quiz-difficulty').value;
      const r = await fetch('/api/quiz?limit=5' + (diff ? '&difficulty=' + diff : ''));
      const { data } = await r.json();
      body.replaceChildren();
      const f = el('form');
      data.forEach((q, i) => {
        const fs = el('fieldset', { className: 'card' }, el('legend', { textContent: `${i + 1}. ${q.question}` }));
        q.options.forEach((o) => fs.append(el('label', { style: 'flex-direction:row;gap:.5rem;color:inherit' }, el('input', { type: 'radio', name: 'q' + q.id, value: o }), o)));
        f.append(fs);
      });
      f.append(el('button', { className: 'btn primary', type: 'submit', textContent: 'Submit answers' }));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const answers = data.map((q) => ({ id: q.id, answer: f.elements['q' + q.id]?.value || '' }));
        const res = await fetch('/api/quiz/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ answers }) });
        const { data: out } = await res.json();
        body.replaceChildren(el('h2', { textContent: `Score: ${out.score} / ${out.total}` }));
        (out.newBadges || []).forEach((b) => body.append(el('p', { className: 'notice', textContent: `${b.icon} New badge: ${b.name}` })));
        out.results.forEach((x) => {
          const q = data.find((d) => d.id === x.id);
          body.append(el('div', { className: 'card' }, el('p', { textContent: (x.correct ? '✅ ' : '❌ ') + q.question }), el('p', { className: 'muted', textContent: `Answer: ${x.correctAnswer}. ${x.explanation || ''}` })));
        });
      });
      body.append(f);
    });
  }
})();
