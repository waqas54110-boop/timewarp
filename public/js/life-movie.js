// Life Movie: the whole life as a cartoon film. Title cards, cartoon scenes with a slow cinematic camera, widescreen bars, subtitles and music.
// Plays on a canvas, with no buttons or map on the picture. "Video banao" plays it again while recording a .webm file you can keep.
(function () {
  const L = window.TimeWarpLife, V = window.TimeWarpVideo, Art = window.TimeWarpArt;
  const root = document.getElementById('life');
  if (!L || !V || !Art || !root) return;
  const W = 1280, H = 720, INK = '#1c1530';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function drawCard(ctx, sh, local, t) {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b1450'); g.addColorStop(1, sh.final ? '#7a2e6e' : '#0b3c5d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { const x = (i * 337 + t * 8) % W, y = (i * 191) % H; ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.35 * Math.abs(Math.sin(t + i))) + ')'; ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, 6.3); ctx.fill(); }
    const pop = V.ease(local / 0.6), sc = 0.85 + 0.15 * pop;
    ctx.save(); ctx.translate(W / 2, H / 2 - 20); ctx.scale(sc, sc); ctx.globalAlpha = pop;
    if (sh.icon) { ctx.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sh.icon, 0, -110); }
    ctx.font = 'bold 76px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.strokeText(sh.title, 0, 0); ctx.fillStyle = '#ffe66d'; ctx.fillText(sh.title, 0, 0);
    ctx.font = '600 34px system-ui,sans-serif'; ctx.fillStyle = '#e8ecff'; ctx.fillText(sh.sub || '', 0, 70);
    (sh.lines || []).forEach((ln, i) => { ctx.font = '28px system-ui,sans-serif'; ctx.fillStyle = '#bfe9ff'; ctx.fillText('★ ' + ln, 0, 130 + i * 40); });
    ctx.restore();
  }
  function drawSceneShot(ctx, sh, p, t, seed) {
    // the picture is painted for the widescreen area between the black bars, so nobody gets cut off
    const cam = V.cameraAt(p, seed), lb = V.letterbox(W, H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, lb.bar, W, lb.inner); ctx.clip();
    ctx.translate(W / 2 + cam.dx * W, H / 2 + cam.dy * lb.inner); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-W / 2, -lb.inner / 2 - lb.bar);
    ctx.translate(0, lb.bar);
    Art.drawScene(ctx, W, lb.inner, sh.state, t);
    ctx.restore();
  }
  function overlay(ctx, sh, local, plan) {
    const lb = V.letterbox(W, H);
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, lb.bar); ctx.fillRect(0, H - lb.bar, W, lb.bar);
    if (sh.kind === 'scene') {
      const slide = V.ease(local / 0.5);
      ctx.save(); ctx.globalAlpha = slide; ctx.font = 'bold 40px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const label = sh.icon + '  ' + sh.title + '  ·  ' + sh.age + ' saal', tw = ctx.measureText(label).width + 50;
      ctx.fillStyle = 'rgba(28,21,48,.88)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(40, lb.bar + 24, tw, 66, 33) : ctx.rect(40, lb.bar + 24, tw, 66); ctx.fill();
      ctx.fillStyle = '#ffe66d'; ctx.fillText(label, 65, lb.bar + 58); ctx.restore();
      const lines = V.wrap(sh.caption, 58).slice(0, 2); ctx.font = '600 32px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
      lines.forEach((ln, i) => { const y = H - lb.bar + 28 + i * 40 - (lines.length - 1) * 4; ctx.strokeStyle = '#000'; ctx.strokeText(ln, W / 2, y); ctx.fillStyle = '#fff'; ctx.fillText(ln, W / 2, y); });
    }
    const f = V.fade(local, sh.dur); if (f > 0) { ctx.fillStyle = 'rgba(0,0,0,' + f + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function open(life) {
    const sum = L.summary(life), plan = V.planMovie(life, sum, L.STAGES, L.stageOf);
    const wrap = el('div', 'mg-overlay movie-overlay'); wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Life Movie');
    const box = el('div', 'movie-box'); wrap.appendChild(box);
    const cv = el('canvas', 'movie-canvas'); cv.width = W; cv.height = H; box.appendChild(cv);
    const bar = el('div', 'movie-bar'); box.appendChild(bar);
    const status = el('span', 'small muted', ''); 
    const mk = (txt, cls, fn) => { const b = el('button', cls, txt); b.type = 'button'; b.addEventListener('click', fn); bar.appendChild(b); return b; };
    const replay = mk('▶ Dobara dekho', 'btn ghost small', () => start(false));
    const rec = mk('⏺ Video banao aur save karo', 'btn primary small', () => start(true));
    const close = mk('Band karo', 'btn ghost small', () => { stop(); if (previewUrl) URL.revokeObjectURL(previewUrl); wrap.remove(); });
    bar.appendChild(status);
    if (!V.canRecord()) { rec.disabled = true; rec.title = 'Is browser mein video recording nahi hoti. Chrome, Edge ya Firefox use karein.'; }
    const ctx = cv.getContext('2d');
    let raf = 0, ac = null, tune = null, rec1 = null, t0 = 0, previewUrl = '';

    function stop() { cancelAnimationFrame(raf); if (tune) { tune.stop(); tune = null; } if (ac) { ac.close().catch(() => {}); ac = null; } }
    function frame() {
      const t = Math.max(0, (performance.now() - t0) / 1000), at = V.shotAt(plan, t);
      if (!at) { finish(); return; }
      const sh = at.shot;
      if (sh.kind === 'card') drawCard(ctx, sh, at.local, t); else drawSceneShot(ctx, sh, at.p, t, at.index);
      overlay(ctx, sh, at.local, plan);
      status.textContent = rec1 ? '⏺ Recording… ' + Math.round(t) + ' / ' + Math.round(plan.duration) + ' s' : Math.round(t) + ' / ' + Math.round(plan.duration) + ' s';
      raf = requestAnimationFrame(frame);
    }
    async function finish() {
      stop();
      if (rec1) {
        const r = rec1; rec1 = null; status.textContent = 'Video ban rahi hai…';
        const blob = await r.stop();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = V.download(blob, 'timewarp-life-movie-' + life.name.replace(/[^\w]+/g, '_') + '.' + (blob.type === 'video/mp4' ? 'mp4' : 'webm'));
        status.textContent = 'Video save ho gayi (' + Math.round(blob.size / 1024 / 1024 * 10) / 10 + ' MB). Downloads folder dekhein.';
      } else status.textContent = 'Film khatam.';
    }
    function start(record) {
      stop(); rec1 = null;
      const AC = window.AudioContext || window.webkitAudioContext;
      let dest = null;
      if (AC) { try { ac = new AC(); dest = ac.createMediaStreamDestination(); const out = ac.createGain(); out.connect(dest); if (!record) out.connect(ac.destination); tune = V.music(ac, out, life.rs); } catch (e) { ac = null; } }
      if (record) { try { rec1 = V.startRecording(cv, { fps: 30, audioStream: dest ? dest.stream : null }); } catch (e) { status.textContent = e.message; stop(); return; } }
      t0 = performance.now(); raf = requestAnimationFrame(frame);
    }
    document.body.appendChild(wrap);
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close.click(); });
    start(false); replay.focus();
  }
  window.TimeWarpMovie = { open };
})();
