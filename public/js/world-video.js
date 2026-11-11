// Live World video (Phase 4):
//   Record      records what the 3D view shows (the canvas only, so buttons and map are never in the video).
//   Aaj ki video  plays back today's walk as a cartoon film: your recorded path with the buttons hidden, toon shading and outlines,
//                 a cinematic camera, widescreen bars, title cards, subtitles from the street ticker, and music. It records itself to a .webm.
// The day is logged in this browser only (localStorage): your position twice a second and the ticker lines. Nothing is uploaded.
// Limits: the film follows YOUR path; the other people and cars are live ones, not a replay, and a vehicle is shown as you gliding along.
const V = window.TimeWarpVideo;
const W = 1280, H = 720, KEEP = 3600;

export function createWorldVideo(c) {
  const { THREE, scene, camera, renderer, canvas, root, tickerEl, player, LIM, mode, YEAR, PLACE } = c;
  const $ = (id) => document.getElementById(id);
  const recBtn = $('rec-btn'), dayBtn = $('day-btn'), msg = $('video-msg');
  const say = (t) => { if (msg) { msg.textContent = t; msg.hidden = !t; } };
  const today = new Date().toISOString().slice(0, 10);
  const KEY = 'timewarp-daylog-v1-' + today + '-' + mode + '-' + YEAR;

  // ---------- the day log ----------
  let log = { points: [], events: [] }, logT = 0, sampleT = 0, saveT = 0;
  try {
    Object.keys(localStorage).forEach((k) => { if (k.startsWith('timewarp-daylog-v1-') && k !== KEY && !k.startsWith('timewarp-daylog-v1-' + today)) localStorage.removeItem(k); });
    const old = JSON.parse(localStorage.getItem(KEY));
    if (old && Array.isArray(old.points) && Array.isArray(old.events)) { log = { points: old.points.slice(-KEEP), events: old.events.slice(-400) }; logT = (log.points.length ? log.points[log.points.length - 1][0] : 0) + 1; }
  } catch (e) { /* storage blocked: the day is only kept while the page is open */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(log)); } catch (e) { /* full or blocked */ } };
  if (tickerEl) new MutationObserver(() => {
    const t = (tickerEl.textContent || '').trim();
    if (!t || t.length > 110) return;
    const last = log.events[log.events.length - 1];
    if (last && last[1] === t) return;
    log.events.push([Math.round(logT * 10) / 10, t]); if (log.events.length > 400) log.events.shift();
  }).observe(tickerEl, { childList: true, characterData: true, subtree: true });
  // called every frame while playing normally (not in a shop, not during a film)
  function sample(dt, pos, inShop) {
    if (active || inShop) return;
    logT += dt; sampleT += dt; saveT += dt;
    if (sampleT >= 0.5) { sampleT = 0; log.points.push([Math.round(logT * 10) / 10, Math.round(pos.x * 10) / 10, Math.round(pos.z * 10) / 10]); if (log.points.length > KEEP) log.points.shift(); }
    if (saveT > 15) { saveT = 0; persist(); }
    if (dayBtn && log.points.length >= 6 && dayBtn.disabled && !busy) dayBtn.disabled = false;
  }
  addEventListener('pagehide', persist);

  // ---------- toon look: swap lit materials for 3-step toon materials, put the originals back afterwards ----------
  let swapped = [], toonMap = null;
  function toonOn() {
    const grad = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true; toonMap = grad;
    const cache = new Map();
    const toon = (m) => {
      if (!m || !m.isMeshLambertMaterial) return m;
      if (!cache.has(m)) { const t = new THREE.MeshToonMaterial({ color: m.color, map: m.map, transparent: m.transparent, opacity: m.opacity, side: m.side, gradientMap: grad, vertexColors: m.vertexColors, emissive: m.emissive, alphaTest: m.alphaTest }); cache.set(m, t); }
      return cache.get(m);
    };
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const orig = o.material; swapped.push([o, orig]);
      o.material = Array.isArray(orig) ? orig.map(toon) : toon(orig);
    });
    cache.forEach((t) => swapped.push([null, t]));
  }
  function toonOff() {
    swapped.forEach(([o, m]) => { if (o) o.material = m; else m.dispose(); });
    swapped = []; if (toonMap) { toonMap.dispose(); toonMap = null; }
  }

  // ---------- compositing the cinematic frame ----------
  const out = document.createElement('canvas'); out.width = W; out.height = H; out.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  const octx = out.getContext('2d');
  const small = document.createElement('canvas'), EW = 480, EH = Math.round(EW * 9 / 16); small.width = EW; small.height = EH;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  let edgeImg = null;
  function edges(lb) {
    sctx.drawImage(canvas, 0, 0, EW, EH);
    const d = sctx.getImageData(0, 0, EW, EH), lum = new Uint8Array(EW * EH);
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (d.data[j] * 54 + d.data[j + 1] * 183 + d.data[j + 2] * 19) >> 8;
    const m = V.edgeMask(lum, EW, EH, 55);
    if (!edgeImg) edgeImg = sctx.createImageData(EW, EH);
    for (let i = 0, j = 0; i < m.length; i++, j += 4) { edgeImg.data[j] = 20; edgeImg.data[j + 1] = 12; edgeImg.data[j + 2] = 40; edgeImg.data[j + 3] = m[i] ? 235 : 0; }
    sctx.putImageData(edgeImg, 0, 0);
  }
  let frameSkip = 0;
  function composite(sh) {
    const lb = V.letterbox(W, H), cw = canvas.width, ch = canvas.height;
    octx.fillStyle = '#000'; octx.fillRect(0, 0, W, H);
    // fill the widescreen window with the middle of the 3D picture
    const sw = cw, shh = Math.min(ch, Math.round(cw / V.RATIO)), sy = Math.round((ch - shh) / 2);
    octx.save(); octx.beginPath(); octx.rect(0, lb.bar, W, lb.inner); octx.clip();
    try { octx.filter = 'saturate(1.35) contrast(1.12)'; } catch (e) { /* not supported */ }
    octx.drawImage(canvas, 0, sy, sw, shh, 0, lb.bar, W, lb.inner);
    octx.filter = 'none';
    if ((frameSkip++ & 1) === 0) { try { edges(lb); } catch (e) { /* ignore */ } }
    octx.globalAlpha = 0.85; octx.drawImage(small, 0, sy / ch * EH, EW, shh / ch * EH, 0, lb.bar, W, lb.inner); octx.globalAlpha = 1;
    octx.restore();
    const vg = octx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)');
    octx.fillStyle = vg; octx.fillRect(0, lb.bar, W, lb.inner);
    // subtitles in the lower bar
    const sub = V.subtitleAt(plan.subs, rt);
    if (sub) { octx.font = '600 30px system-ui,sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.lineWidth = 7; octx.lineJoin = 'round'; V.wrap(sub, 60).slice(0, 2).forEach((ln, i) => { const y = H - lb.bar + 30 + i * 38; octx.strokeStyle = '#000'; octx.strokeText(ln, W / 2, y); octx.fillStyle = '#fff'; octx.fillText(ln, W / 2, y); }); }
    // title card at the start, end card at the end
    const inIntro = rt < plan.intro, inOutro = rt > plan.duration - plan.outro;
    if (inIntro || inOutro) {
      const local = inIntro ? rt : rt - (plan.duration - plan.outro), len = inIntro ? plan.intro : plan.outro;
      const a = Math.min(1, V.fade(local, len, 0.6) * 0 + (inIntro ? 1 - local / len * 0.55 : V.ease(local / 0.8) * 0.8));
      octx.fillStyle = 'rgba(15,10,45,' + (inIntro ? 0.75 * (1 - V.ease((local - len + 1) / 1)) : a) + ')'; octx.fillRect(0, 0, W, H);
      const pop = V.ease(local / 0.6); octx.save(); octx.translate(W / 2, H / 2); octx.scale(0.88 + 0.12 * pop, 0.88 + 0.12 * pop); octx.globalAlpha = pop * (inIntro ? 1 - V.ease((local - len + 0.8) / 0.8) : 1);
      octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.lineJoin = 'round'; octx.lineWidth = 12; octx.strokeStyle = '#1c1530';
      const title = inIntro ? 'Episode 1: Aaj ka din' : 'Khatam', sub2 = inIntro ? PLACE + ' · ' + (YEAR < 0 ? -YEAR + ' BCE' : YEAR) : plan.distance + ' metre ka safar · ' + plan.missions + ' mission';
      octx.font = 'bold 72px system-ui,sans-serif'; octx.strokeText(title, 0, -10); octx.fillStyle = '#ffe66d'; octx.fillText(title, 0, -10);
      octx.font = '600 32px system-ui,sans-serif'; octx.fillStyle = '#e8ecff'; octx.fillText(sub2, 0, 60); octx.restore();
    }
  }

  // ---------- the replay ----------
  let active = false, busy = false, rt = 0, plan = null, rec = null, ac = null, tune = null, saved = null, face = 0, shotCam = new THREE.Vector3(), camInit = false, previewUrl = '';
  const keyBlock = (e) => { if (!active) return; if (e.key === 'Escape') stopReplay(true); e.stopImmediatePropagation(); e.preventDefault(); };
  addEventListener('keydown', keyBlock, true); addEventListener('keyup', keyBlock, true);

  async function startReplay() {
    if (active || busy) return;
    const pts = log.points;
    plan = V.dayPlan(pts, log.events, { maxSecs: 70 });
    if (!plan) { say('Abhi video ke liye kaafi ghoomna baqi hai: thori der chalein aur phir koshish karein.'); return; }
    plan.missions = log.events.filter((e) => /^Mission complete/.test(e[1])).length;
    saved = { x: player.group.position.x, z: player.group.position.z, ry: player.group.rotation.y };
    active = busy = true; rt = 0; camInit = false; face = 0;
    root.classList.add('rec-clean'); toonOn(); document.body.appendChild(out);
    let dest = null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { try { ac = new AC(); dest = ac.createMediaStreamDestination(); const g = ac.createGain(); g.connect(dest); tune = V.music(ac, g, YEAR + 3); } catch (e) { ac = null; } }
    if (V.canRecord()) { try { rec = V.startRecording(out, { fps: 30, audioStream: dest ? dest.stream : null }); } catch (e) { rec = null; } }
    say(rec ? 'Video ban rahi hai… (Esc dabane se ruk jayegi)' : 'Film chal rahi hai (is browser mein recording nahi hoti). Esc se band karein.');
    if (dayBtn) dayBtn.disabled = true; if (recBtn) recBtn.disabled = true;
  }
  async function stopReplay(cancelled) {
    if (!active) return;
    active = false;
    toonOff(); root.classList.remove('rec-clean'); out.remove();
    if (tune) { tune.stop(); tune = null; } if (ac) { ac.close().catch(() => {}); ac = null; }
    if (saved) { player.group.position.x = saved.x; player.group.position.z = saved.z; player.group.rotation.y = saved.ry; saved = null; }
    const r = rec; rec = null;
    if (r) {
      say('Video save ho rahi hai…'); const blob = await r.stop();
      if (!cancelled && blob.size > 0) { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = V.download(blob, 'timewarp-aaj-ki-video-' + today + '.' + (blob.type === 'video/mp4' ? 'mp4' : 'webm')); say('Aaj ki video save ho gayi (' + Math.round(blob.size / 104857.6) / 10 + ' MB). Downloads folder dekhein.'); }
      else say('Video cancel ho gayi.');
    } else say(cancelled ? '' : 'Film khatam.');
    busy = false; if (dayBtn) dayBtn.disabled = log.points.length < 6; if (recBtn) recBtn.disabled = false;
  }
  // per frame while the film plays: where the player is, and whether to finish
  function step(dt) {
    rt += dt;
    if (rt >= plan.duration) { stopReplay(false); return null; }
    const tLog = plan.t0 + Math.min(plan.body, Math.max(0, rt - plan.intro)) * plan.speed;
    const p = V.dayPos(log.points, tLog), mv = Math.hypot(p.dx, p.dz);
    const moving = mv > 0.2 && rt > plan.intro && rt < plan.duration - plan.outro;
    if (moving) face = Math.atan2(p.dx, p.dz);
    const cur = player.group.rotation.y; player.group.visible = true;
    return { x: p.x, z: p.z, ry: cur + Math.atan2(Math.sin(face - cur), Math.cos(face - cur)) * Math.min(1, dt * 8), walking: moving };
  }
  // cinematic camera: every 6 s a new angle, always moving slowly
  function cam(pos, dt) {
    const ry = player.group.rotation.y, shot = Math.floor(rt / 6) % 4, drift = rt * 0.12;
    const fx = Math.sin(ry), fz = Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry);
    let ox, oy, oz;
    if (shot === 0) { ox = -fx * 7 + rx * Math.sin(drift) * 2; oy = 3.2; oz = -fz * 7 + rz * Math.sin(drift) * 2; }
    else if (shot === 1) { ox = rx * 6 - fx * 1.5; oy = 1.1; oz = rz * 6 - fz * 1.5; }
    else if (shot === 2) { ox = fx * 6 + rx * 1.5; oy = 1.9 + Math.sin(drift) * 0.4; oz = fz * 6 + rz * 1.5; }
    else { ox = -fx * 9 + rx * 8; oy = 11; oz = -fz * 9 + rz * 8; }
    const want = new THREE.Vector3(pos.x + ox, pos.y + oy, pos.z + oz);
    want.x = Math.max(-LIM - 6, Math.min(LIM + 6, want.x)); want.z = Math.max(-LIM - 6, Math.min(LIM + 6, want.z));
    if (!camInit) { shotCam.copy(want); camInit = true; } else shotCam.lerp(want, Math.min(1, dt * 1.8));
    camera.position.copy(shotCam); camera.lookAt(pos.x, pos.y + 1.3, pos.z);
  }
  function afterRender() { if (active && plan) composite(); }

  // ---------- manual Record ----------
  let manual = null, manualT = 0, manualTimer = 0;
  async function toggleManual() {
    if (busy && !manual) return;
    if (!manual) {
      try { manual = V.startRecording(canvas, { fps: 30 }); } catch (e) { say(e.message); return; }
      manualT = performance.now(); busy = true; if (dayBtn) dayBtn.disabled = true;
      recBtn.textContent = '■ Roko aur save karo'; recBtn.setAttribute('aria-pressed', 'true');
      manualTimer = setInterval(() => say('⏺ Recording… ' + Math.round((performance.now() - manualT) / 1000) + ' s'), 500);
    } else {
      clearInterval(manualTimer); const r = manual; manual = null; say('Video save ho rahi hai…');
      const blob = await r.stop(); if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = V.download(blob, 'timewarp-record-' + Date.now() + '.' + (blob.type === 'video/mp4' ? 'mp4' : 'webm'));
      say('Video save ho gayi (' + Math.round(blob.size / 104857.6) / 10 + ' MB).');
      recBtn.textContent = '⏺ Record'; recBtn.setAttribute('aria-pressed', 'false'); busy = false; if (dayBtn) dayBtn.disabled = log.points.length < 6;
    }
  }
  if (recBtn) { if (!V.canRecord()) { recBtn.disabled = true; recBtn.title = 'Is browser mein video recording nahi hoti. Chrome, Edge ya Firefox use karein.'; } recBtn.addEventListener('click', toggleManual); }
  if (dayBtn) { dayBtn.disabled = log.points.length < 6; dayBtn.addEventListener('click', startReplay); }

  return { sample, step, cam, afterRender, get active() { return active; }, stop: () => stopReplay(true), get log() { return log; } };
}
