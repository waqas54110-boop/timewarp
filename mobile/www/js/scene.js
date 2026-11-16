(() => {
  const scene = document.getElementById('scene-canvas') && document.getElementById('journey');
  if (!scene) return;
  const $ = (s, r = document) => r.querySelector(s);
  const mode = scene.dataset.mode;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Page chrome sits behind the full-screen scene: take it out of the tab order.
  ['.site-header', '.site-footer', '.skip'].forEach((s) => { const n = $(s); if (n) n.inert = true; });

  // ---------- Arrival: count the year from today to the destination ----------
  const yearEl = $('#scene-year');
  const target = Number(scene.dataset.year);
  const fmt = (y) => (y < 0 ? `${-y} BCE` : y < 1000 ? `${y} CE` : String(y));
  if (yearEl && !reduce) {
    const from = new Date().getFullYear(), t0 = performance.now(), dur = 1500;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      yearEl.textContent = k < 1 ? fmt(Math.round(from + (target - from) * e)) : yearEl.dataset.label;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- Generated scene (used when there is no image/video, or it fails to load) ----------
  const canvas = $('#scene-canvas');
  const ctx = canvas.getContext('2d');
  const PAL = {
    future: { sky: ['#05031a', '#2a1065', '#7c3aed'], glow: '#a78bfa', edge: '#22d3ee', win: ['#67e8f9', '#c4b5fd', '#f0abfc'] },
    present: { sky: ['#06122b', '#0e3a6b', '#22d3ee'], glow: '#22d3ee', edge: '#7dd3fc', win: ['#fde68a', '#e0f2fe', '#fcd34d'] },
    past: { sky: ['#1a0f05', '#7a4a1c', '#ffb347'], glow: '#ffcf8a', edge: '#ffb347', win: [] },
  };
  const P = PAL[mode] || PAL.present;
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let bg = null, W = 0, H = 0, parts = [], stars = [], raf = 0, paused = reduce, running = false, last = 0;

  function buildBackground() {
    const r = rng(Math.abs(target) * 7 + 13);
    bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, P.sky[0]); sky.addColorStop(0.6, P.sky[1]); sky.addColorStop(1, P.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);

    stars = [];
    if (mode !== 'past') for (let i = 0; i < 160; i++) stars.push({ x: r() * W, y: r() * H * 0.55, s: (0.5 + r() * 1.3) * (H / 700), p: r() * 6.28 });

    const gx = W * (0.3 + r() * 0.4), gy = H * 0.64;
    const glow = g.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.55);
    glow.addColorStop(0, P.glow + '66'); glow.addColorStop(1, P.glow + '00');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);

    const u = H / 700;
    if (mode === 'past') {
      const sx = W * (0.62 + r() * 0.2), sy = H * 0.42;
      const sun = g.createRadialGradient(sx, sy, 0, sx, sy, 120 * u);
      sun.addColorStop(0, '#fff6dd'); sun.addColorStop(0.35, '#ffd58a'); sun.addColorStop(1, '#ffb34700');
      g.fillStyle = sun; g.beginPath(); g.arc(sx, sy, 120 * u, 0, 6.28); g.fill();
      for (let l = 0; l < 4; l++) {
        const base = H * (0.62 + l * 0.08), amp = (26 - l * 4) * u, k = 0.004 + l * 0.0015, ph = r() * 6;
        g.fillStyle = `rgb(${46 - l * 10},${24 - l * 5},${10 - l * 2})`;
        g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, base + Math.sin(x * k + ph) * amp + Math.sin(x * k * 2.3 + ph) * amp * 0.4);
        g.lineTo(W, H); g.closePath(); g.fill();
        if (l === 1) { // a few arched gateways on the middle ridge
          g.fillStyle = `rgb(${34},${18},${8})`;
          for (let i = 0; i < 3; i++) {
            const ax = W * (0.12 + i * 0.3 + r() * 0.1), aw = (70 + r() * 40) * u, ah = (120 + r() * 60) * u, ay = base + 8 * u;
            const pw = aw * 0.24, ar = (aw - pw) / 2, top = ay - ah * 0.55; // open gateway: pillars + arch, sky shows through
            g.fillRect(ax, top, pw, ay - top); g.fillRect(ax + aw - pw, top, pw, ay - top);
            g.strokeStyle = '#220f06'; g.lineWidth = pw; g.beginPath(); g.arc(ax + aw / 2, top, ar, Math.PI, 0); g.stroke();
            g.fillRect(ax - pw * 0.2, top - ar - pw * 1.2, aw + pw * 0.4, pw * 0.5);
            g.beginPath(); g.arc(ax + aw / 2, top - ar - pw * 1.2, aw * 0.3, Math.PI, 0); g.fill();
            g.fillStyle = '#220f06';
          }
        }
      }
    } else {
      const tall = mode === 'future' ? 0.38 : 0.24;
      for (let l = 0; l < 3; l++) {
        const base = H * (0.7 + l * 0.08), scale = (0.7 + l * 0.35) * u;
        g.fillStyle = `rgb(${8 + l * 8},${6 + l * 8},${30 + l * 14})`;
        let x = -20;
        while (x < W) {
          const bw = (28 + r() * 54) * scale * 1.4, bh = H * (0.1 + r() * tall) * (1 - l * 0.18);
          g.fillRect(x, base - bh, bw, H);
          if (mode === 'future' && r() < 0.28) { g.beginPath(); g.moveTo(x + bw * 0.5, base - bh - 70 * scale); g.lineTo(x + bw * 0.8, base - bh); g.lineTo(x + bw * 0.2, base - bh); g.fill(); }
          if (l === 2) { g.fillStyle = P.edge + '88'; g.fillRect(x, base - bh, bw, Math.max(1, 1.5 * u)); g.fillStyle = `rgb(${8 + l * 8},${6 + l * 8},${30 + l * 14})`; }
          const ws = 3 * scale, gap = 9 * scale;
          for (let wy = base - bh + 10 * scale; wy < base - 4; wy += gap)
            for (let wx = x + 6 * scale; wx < x + bw - 6 * scale; wx += gap)
              if (r() < 0.3 - l * 0.06) { g.fillStyle = P.win[(r() * P.win.length) | 0]; g.globalAlpha = 0.55 + r() * 0.4; g.fillRect(wx, wy, ws, ws * 1.4); g.globalAlpha = 1; }
          g.fillStyle = `rgb(${8 + l * 8},${6 + l * 8},${30 + l * 14})`;
          x += bw + r() * 6 * scale;
        }
      }
    }
    const fade = g.createLinearGradient(0, H * 0.85, 0, H);
    fade.addColorStop(0, '#00000000'); fade.addColorStop(1, '#000000cc');
    g.fillStyle = fade; g.fillRect(0, H * 0.85, W, H * 0.15);
  }

  function seedParticles() {
    const r = rng(Math.abs(target) + 99), u = H / 700;
    parts = [];
    const n = mode === 'future' ? 22 : mode === 'present' ? 28 : 90;
    for (let i = 0; i < n; i++) {
      if (mode === 'future') parts.push({ x: r() * W, y: H * (0.12 + r() * 0.5), v: (60 + r() * 160) * u * (r() < 0.5 ? -1 : 1), s: (1.5 + r() * 2) * u, c: P.win[(r() * 3) | 0] });
      else if (mode === 'present') parts.push({ x: r() * W, y: r() * H, v: -(8 + r() * 20) * u, s: (6 + r() * 26) * u, a: 0.05 + r() * 0.15, d: (r() - 0.5) * 10 * u });
      else parts.push({ x: r() * W, y: r() * H, v: -(3 + r() * 10) * u, s: (0.8 + r() * 2) * u, a: 0.15 + r() * 0.4, d: (6 + r() * 18) * u });
    }
  }

  function draw(t, dt) {
    ctx.drawImage(bg, 0, 0);
    for (const s of stars) { ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t / 900 + s.p)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.s, s.s); }
    ctx.globalAlpha = 1;
    for (const p of parts) {
      if (mode === 'future') { // flying vehicles with light trails
        p.x += p.v * dt; if (p.x < -80) p.x = W + 40; if (p.x > W + 80) p.x = -40;
        const tr = ctx.createLinearGradient(p.x, 0, p.x - Math.sign(p.v) * 70 * (H / 700), 0);
        tr.addColorStop(0, p.c); tr.addColorStop(1, p.c + '00');
        ctx.fillStyle = tr; ctx.fillRect(Math.min(p.x, p.x - Math.sign(p.v) * 70 * (H / 700)), p.y, 70 * (H / 700), p.s);
        ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 1, p.y - 0.5, p.s * 1.4, p.s * 1.4);
      } else {
        p.y += p.v * dt; p.x += (p.d || 0) * dt;
        if (p.y < -40) { p.y = H + 20; p.x = Math.random() * W; } if (p.x > W + 40) p.x = -20; if (p.x < -40) p.x = W + 20;
        ctx.globalAlpha = p.a;
        ctx.fillStyle = mode === 'present' ? P.glow : '#ffe2b0';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.28); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = Math.round(canvas.clientWidth * dpr);
    H = canvas.height = Math.round(canvas.clientHeight * dpr);
    buildBackground(); seedParticles(); draw(performance.now(), 0);
  }
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    if (!document.hidden) draw(t, dt);
  }
  function startCanvas() { if (!running && !paused) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stopCanvas() { running = false; cancelAnimationFrame(raf); }

  // ---------- Image / video layer on top of the generated scene ----------
  const video = $('#scene-video'), img = $('#scene-img');
  let mediaOk = false;
  const dropMedia = (el) => { el?.remove(); if (!mediaOk) startCanvas(); };
  if (video) {
    video.addEventListener('error', () => dropMedia(video));
    video.addEventListener('loadeddata', () => { mediaOk = true; stopCanvas(); canvas.style.visibility = 'hidden'; if (!paused) video.play().catch(() => {}); });
  }
  if (img) {
    const ok = () => { mediaOk = true; stopCanvas(); canvas.style.visibility = 'hidden'; };
    img.addEventListener('load', ok); img.addEventListener('error', () => dropMedia(img));
    if (img.complete) (img.naturalWidth ? ok : () => dropMedia(img))();
  }

  resize();
  window.addEventListener('resize', resize);
  if (!img && !video) startCanvas();
  else if (!mediaOk) startCanvas(); // keeps the generated scene alive until the media is ready

  // ---------- Pause / sound ----------
  const pauseBtn = $('#scene-pause'), muteBtn = $('#scene-mute');
  const syncPause = () => { pauseBtn.textContent = paused ? 'Play' : 'Pause'; pauseBtn.setAttribute('aria-pressed', String(paused)); };
  syncPause();
  pauseBtn.addEventListener('click', () => {
    paused = !paused; syncPause();
    if (paused) { stopCanvas(); video?.pause(); }
    else if (video && mediaOk) video.play().catch(() => {});
    else if (!mediaOk) startCanvas();
  });
  muteBtn?.addEventListener('click', () => {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? 'Sound off' : 'Sound on';
    muteBtn.setAttribute('aria-pressed', String(video.muted));
  });

  // ---------- Show details sheet ----------
  const sheet = $('#details'), toggle = $('#details-toggle'), close = $('#details-close');
  const behind = [$('.scene-top'), $('.scene-caption'), $('#party-panel')];
  function setSheet(open) {
    sheet.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    behind.forEach((n) => { if (n) n.inert = open; });
    if (open) { $('.details-inner', sheet).scrollTop = 0; close.focus(); } else toggle.focus();
  }
  toggle.addEventListener('click', () => setSheet(sheet.hidden));
  close.addEventListener('click', () => setSheet(false));
  sheet.addEventListener('click', (e) => { if (e.target === sheet) setSheet(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) setSheet(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) video?.pause(); else if (!paused && video && mediaOk) video.play().catch(() => {}); });
  window.addEventListener('pagehide', stopCanvas);
})();
