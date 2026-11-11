// TimeWarp video toolkit (Phase 4): cinematic helpers, a canvas recorder, generated music and the Life Movie plan.
// Pure parts (planMovie, shotAt, letterbox, wrap, edgeMask, subtitleAt, dayPlan) are tested in tests/video.test.js.
// The recorder and the music need a browser (MediaRecorder, Web Audio). Nothing is uploaded: the video is made and saved on the player's device.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpVideo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const STAGE_NAMES = { baby: 'Baby', child: 'Bachpan', school: 'School', college: 'College', career: 'Career', senior: 'Budhapa' };
  const RATIO = 2.39; // cinema widescreen

  // ---------- cinematic helpers ----------
  // letterbox(W, H) -> black bar height at top and bottom so the picture between them is 2.39:1
  function letterbox(W, H) { const inner = Math.min(H, Math.round(W / RATIO)); return { bar: Math.round((H - inner) / 2), inner }; }
  // wrap(text, maxChars) -> lines no longer than maxChars (words are never cut)
  function wrap(text, maxChars) {
    const lines = []; let cur = '';
    String(text || '').split(/\s+/).filter(Boolean).forEach((w) => {
      if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  // subtitleAt(list, t): list = [{t0, t1, text}]
  function subtitleAt(list, t) { for (let i = list.length - 1; i >= 0; i--) if (t >= list[i].t0 && t < list[i].t1) return list[i].text; return ''; }
  // cinematic camera for a shot, p = 0..1: slow push-in with a drift. Returns {zoom, dx, dy} (dx, dy as a fraction of the width / height)
  function cameraAt(p, seed) {
    const dir = (seed || 0) % 2 ? 1 : -1;
    return { zoom: 1.08 + 0.12 * ease(p), dx: dir * 0.03 * (p - 0.5), dy: -0.015 * (p - 0.5) };
  }
  // edgeMask(lum, w, h, thr): Sobel edges of a luminance image (0..255 values) -> Uint8Array, 255 on an edge, else 0. Used for the cartoon outline.
  function edgeMask(lum, w, h, thr) {
    const out = new Uint8Array(w * h), T = thr == null ? 60 : thr;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
      const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
      if (Math.abs(gx) + Math.abs(gy) > T * 2) out[i] = 255;
    }
    return out;
  }

  // ---------- Life Movie plan ----------
  // planMovie(life, sum, STAGES, stageOf) -> { shots, duration }. A shot is a title card or a cartoon scene with a caption.
  function planMovie(life, sum, STAGES, stageOf) {
    const shots = [];
    const add = (sh) => { sh.t0 = shots.length ? shots[shots.length - 1].t1 : 0; sh.t1 = sh.t0 + sh.dur; shots.push(sh); };
    add({ kind: 'card', dur: 4, title: life.name + ' ki Zindagi', sub: 'Ek cartoon film · Life Movie', stage: 'baby' });
    let ep = 0;
    STAGES.forEach((st) => {
      const mems = (life.memories || []).filter((m) => stageOf(m.age).id === st.id);
      if (!mems.length) return;
      ep++;
      add({ kind: 'card', dur: 2.5, title: 'Episode ' + ep + ': ' + st.name, sub: st.to > 150 ? st.from + ' saal ke baad' : st.from + ' se ' + st.to + ' saal', stage: st.id, icon: st.icon });
      mems.forEach((m) => add({
        kind: 'scene', dur: 4.2, stage: st.id, age: m.age, icon: m.icon, title: m.title, caption: m.text,
        state: { stage: st.id, era: life.era, job: m.age >= 22 ? (life.flags || {}).job : undefined, married: m.age >= 27 && !!(life.flags || {}).married, children: m.age >= 29 && (life.flags || {}).children ? 2 : 0, view: m.age >= 29 && (life.flags || {}).children ? 'family' : '' },
      }));
    });
    add({ kind: 'card', dur: 6, title: 'Life Score: ' + sum.score + ' / 100', sub: sum.title, lines: (sum.virtues || []).slice(0, 3).map((v) => v.name + ' (' + v.value + ')'), stage: 'senior', final: true });
    return { shots, duration: shots[shots.length - 1].t1 };
  }
  // shotAt(plan, t) -> { shot, index, local, p } or null when t is past the end
  function shotAt(plan, t) {
    for (let i = 0; i < plan.shots.length; i++) { const s = plan.shots[i]; if (t >= s.t0 && t < s.t1) return { shot: s, index: i, local: t - s.t0, p: (t - s.t0) / s.dur }; }
    return null;
  }
  // fade(p, dur, fadeSecs) -> 0..1 black overlay strength at the start and end of a shot
  function fade(local, dur, f) { const fs = f == null ? 0.45 : f; return Math.max(1 - local / fs, 1 - (dur - local) / fs, 0); }

  // ---------- Live World "today's video" plan ----------
  // dayPlan(points, events, opts) -> compresses the day so it fits in about maxSecs. points = [[t,x,z]], events = [[t,text]].
  function dayPlan(points, events, opts) {
    const o = Object.assign({ maxSecs: 75, intro: 3.5, outro: 4.5 }, opts);
    if (!points || points.length < 2) return null;
    const len = points[points.length - 1][0] - points[0][0];
    const speed = Math.max(1, len / o.maxSecs), body = len / speed;
    const subs = (events || []).filter((e) => e[0] >= points[0][0]).map((e) => { const t0 = o.intro + (e[0] - points[0][0]) / speed; return { t0, t1: t0 + 3.2, text: e[1] }; });
    let dist = 0; for (let i = 1; i < points.length; i++) dist += Math.hypot(points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
    return { speed, body, intro: o.intro, outro: o.outro, duration: o.intro + body + o.outro, subs, distance: Math.round(dist), t0: points[0][0] };
  }
  // dayPos(points, tLog) -> {x, z, dx, dz}: position on the recorded path at log time tLog (linear between samples)
  function dayPos(points, tLog) {
    let lo = 0, hi = points.length - 1;
    if (tLog <= points[0][0]) return { x: points[0][1], z: points[0][2], dx: 0, dz: 0 };
    if (tLog >= points[hi][0]) return { x: points[hi][1], z: points[hi][2], dx: 0, dz: 0 };
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (points[m][0] <= tLog) lo = m; else hi = m; }
    const a = points[lo], b = points[hi], k = (tLog - a[0]) / Math.max(1e-6, b[0] - a[0]);
    return { x: a[1] + (b[1] - a[1]) * k, z: a[2] + (b[2] - a[2]) * k, dx: b[1] - a[1], dz: b[2] - a[2] };
  }

  // ---------- browser: recorder, music, download ----------
  function pickMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  }
  const canRecord = () => typeof MediaRecorder !== 'undefined' && !!pickMime();
  // startRecording(canvas, {fps, audioStream}) -> { stop(): Promise<Blob>, mime }
  function startRecording(canvas, o) {
    const opt = o || {}, mime = pickMime();
    if (!mime || !canvas.captureStream) throw new Error('This browser cannot record video. Try Chrome, Edge or Firefox.');
    const stream = canvas.captureStream(opt.fps || 30);
    if (opt.audioStream) opt.audioStream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: opt.bitrate || 5000000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.start(500);
    return { mime, stop: () => new Promise((resolve) => { rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] })); if (rec.state !== 'inactive') rec.stop(); else resolve(new Blob(chunks, { type: mime.split(';')[0] })); }) };
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return url; // the caller revokes it when the preview is closed
  }
  // generated background music: a gentle pentatonic tune, different for every seed. start(ac, node, seed) -> { stop() }
  function music(ac, out, seed) {
    const scale = [0, 2, 4, 7, 9, 12, 14, 16], base = 220;
    let s = (seed | 0) || 7, step = 0, next = ac.currentTime + 0.1;
    const r = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const master = ac.createGain(); master.gain.value = 0.16; master.connect(out);
    const note = (freq, at, len, vol, type) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g); g.connect(master); o.start(at); o.stop(at + len + 0.05);
    };
    const beat = 0.5, roots = [0, 5, 7, 3];
    const timer = setInterval(() => {
      while (next < ac.currentTime + 0.6) {
        const bar = Math.floor(step / 4), root = roots[bar % 4];
        if (step % 4 === 0) { [0, 4, 7].forEach((iv) => note(base / 2 * Math.pow(2, (root + iv) / 12), next, beat * 4, 0.25, 'sine')); }
        if (r() < 0.8) note(base * Math.pow(2, (root + scale[Math.floor(r() * scale.length)]) / 12), next, beat * 0.9, 0.5, 'triangle');
        step++; next += beat;
      }
    }, 120);
    return { stop() { clearInterval(timer); try { master.gain.setTargetAtTime(0, ac.currentTime, 0.1); } catch (e) { /* closed */ } } };
  }

  return { STAGE_NAMES, RATIO, ease, letterbox, wrap, subtitleAt, cameraAt, edgeMask, planMovie, shotAt, fade, dayPlan, dayPos, pickMime, canRecord, startRecording, download, music };
});
