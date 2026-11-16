// TimeWarp cartoon scenes for Life Mode (canvas 2D, drawn in code: no image files, nothing to license).
// drawScene(ctx, w, h, state, t) paints the scene for the player's current stage; the same function paints the frames of the Life Movie.
// state = { stage: 'baby'|'child'|'school'|'college'|'career'|'senior', era: 'past'|'present'|'future', job, married, children }
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const INK = '#1c1530';
  const PAL = {
    past: { sky: ['#f0d9a8', '#d9a86c'], ground: '#a07c4e', wall: '#e8d2a8', accent: '#8a5a2b', sun: '#fff1c2' },
    present: { sky: ['#7cc8ff', '#e4f5ff'], ground: '#6cbf5a', wall: '#f4ead7', accent: '#e4572e', sun: '#fff3a0' },
    future: { sky: ['#1d1f5e', '#8a63ff'], ground: '#2c2f66', wall: '#cfd8ff', accent: '#18e0c8', sun: '#bff8ff' },
  };
  const JOB_ICON = { doctor: '🩺', engineer: '📐', software: '💻', pilot: '✈️', accountant: '📊', teacher: '🍎', business: '🧾', police: '🚓', shopkeeper: '🏪', taxi: '🚕', delivery: '🛵' };
  const SKIN = ['#f1c27d', '#e0ac69', '#c68642'];

  function pen(ctx, lw) { ctx.lineWidth = lw || 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
  function fillStroke(ctx, color) { ctx.fillStyle = color; ctx.fill(); ctx.stroke(); }
  function rrect(ctx, x, y, w, h, r) {
    const q = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + q, y); ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q); ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath();
  }
  function box(ctx, x, y, w, h, color, r) { pen(ctx); rrect(ctx, x, y, w, h, r == null ? 6 : r); fillStroke(ctx, color); }
  function circle(ctx, x, y, r, color) { pen(ctx); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); fillStroke(ctx, color); }
  function emoji(ctx, ch, x, y, size) { ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x, y); }
  function label(ctx, text, x, y, size, color) { ctx.font = 'bold ' + size + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color || INK; ctx.fillText(text, x, y); }

  function sky(ctx, w, h, P, t, night) {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, night ? '#3b2a6b' : P.sky[0]); g.addColorStop(1, night ? '#e58f5b' : P.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    circle(ctx, w * 0.82, h * 0.2, h * 0.08, P.sun);
    [0.15, 0.45, 0.7].forEach((fx, i) => { const x = ((fx * w + t * (6 + i * 3)) % (w + 120)) - 60, y = h * (0.12 + i * 0.07); pen(ctx, 2.5); ctx.beginPath(); ctx.arc(x, y, 16, 0, 6.3); ctx.arc(x + 20, y + 4, 13, 0, 6.3); ctx.arc(x - 18, y + 5, 11, 0, 6.3); fillStroke(ctx, 'rgba(255,255,255,.9)'); });
  }
  function ground(ctx, w, h, y, color) { ctx.fillStyle = color; ctx.fillRect(0, y, w, h - y); pen(ctx, 3); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  function tree(ctx, x, y, s) { box(ctx, x - 5 * s, y - 40 * s, 10 * s, 40 * s, '#8b5a2b', 3); circle(ctx, x, y - 58 * s, 26 * s, '#3fa34d'); circle(ctx, x - 16 * s, y - 46 * s, 17 * s, '#4cba5a'); circle(ctx, x + 16 * s, y - 46 * s, 17 * s, '#4cba5a'); }

  // person(ctx, x, footY, height, opts): a cartoon person. kind: baby | kid | adult | old
  function person(ctx, x, y, hgt, o) {
    const k = o.kind || 'adult', t = o.t || 0, skin = o.skin || SKIN[0];
    const headR = hgt * (k === 'baby' ? 0.3 : k === 'kid' ? 0.2 : 0.14), bodyH = hgt * (k === 'baby' ? 0.28 : 0.36), legH = hgt - headR * 2 - bodyH;
    const bodyW = hgt * (k === 'baby' ? 0.34 : 0.22), sw = Math.sin(t * 6 + (o.phase || 0)) * (o.walk ? 0.35 : 0.05);
    const lean = k === 'old' ? 6 : 0;
    pen(ctx, 3);
    [-1, 1].forEach((d) => { ctx.save(); ctx.translate(x + d * bodyW * 0.22 + lean * 0.3, y - legH); ctx.rotate(sw * d); box(ctx, -bodyW * 0.14, 0, bodyW * 0.28, legH, o.pants || '#2d3a6b', 3); ctx.restore(); });
    const by = y - legH - bodyH;
    ctx.save(); ctx.translate(lean, 0);
    box(ctx, x - bodyW / 2, by, bodyW, bodyH, o.shirt || '#e4572e', 8);
    if (o.coat) { box(ctx, x - bodyW / 2, by, bodyW, bodyH, 'rgba(255,255,255,.95)', 8); pen(ctx, 2); ctx.beginPath(); ctx.moveTo(x, by + 4); ctx.lineTo(x, by + bodyH); ctx.stroke(); }
    [-1, 1].forEach((d) => { ctx.save(); ctx.translate(x + d * bodyW / 2, by + bodyH * 0.15); ctx.rotate((o.wave && d > 0 ? -2.4 + Math.sin(t * 8) * 0.4 : sw * -d) + d * 0.15); box(ctx, -3, 0, 7, bodyH * 0.8, o.coat ? '#fff' : (o.shirt || '#e4572e'), 3); circle(ctx, 0.5, bodyH * 0.8, 4.5, skin); ctx.restore(); });
    const hy = by - headR * 0.85;
    circle(ctx, x, hy, headR, skin);
    pen(ctx, 3); ctx.beginPath(); ctx.arc(x, hy - headR * 0.1, headR * 1.02, Math.PI * 1.02, Math.PI * 1.98); fillStroke(ctx, o.hair || (k === 'old' ? '#e8e8f0' : '#2a1c14'));
    if (o.cap) { ctx.beginPath(); ctx.arc(x, hy - headR * 0.2, headR * 1.08, Math.PI, 0); ctx.lineTo(x + headR * 1.4, hy - headR * 0.2); ctx.lineTo(x - headR * 1.08, hy - headR * 0.2); ctx.closePath(); fillStroke(ctx, o.cap); }
    ctx.fillStyle = INK; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.arc(x + d * headR * 0.38, hy + headR * 0.05, Math.max(1.8, headR * 0.1), 0, 6.3); ctx.fill(); });
    pen(ctx, 2); ctx.beginPath(); ctx.arc(x, hy + headR * 0.25, headR * 0.3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    if (k === 'old') { pen(ctx, 3); ctx.beginPath(); ctx.moveTo(x + bodyW * 0.8, by + bodyH * 0.6); ctx.lineTo(x + bodyW * 0.9, y); ctx.stroke(); }
    ctx.restore();
  }

  function hospital(ctx, w, h, P, s, t) {
    ctx.fillStyle = P.wall; ctx.fillRect(0, 0, w, h); ground(ctx, w, h, h * 0.78, '#cfe3ee');
    box(ctx, w * 0.08, h * 0.12, w * 0.18, h * 0.3, P.sky[1], 6); pen(ctx, 2); ctx.beginPath(); ctx.moveTo(w * 0.17, h * 0.12); ctx.lineTo(w * 0.17, h * 0.42); ctx.moveTo(w * 0.08, h * 0.27); ctx.lineTo(w * 0.26, h * 0.27); ctx.stroke();
    box(ctx, w * 0.42, h * 0.08, 46, 46, '#fff', 8); label(ctx, '+', w * 0.42 + 23, h * 0.08 + 24, 38, '#e63946');
    box(ctx, w * 0.36, h * 0.52, w * 0.3, h * 0.26, '#fff', 10); box(ctx, w * 0.36, h * 0.46, w * 0.07, h * 0.32, '#9ec5fe', 6);
    circle(ctx, w * 0.52, h * 0.52, 21, SKIN[0]); box(ctx, w * 0.43, h * 0.56, w * 0.2, h * 0.12, '#ffd6e0', 14); circle(ctx, w * 0.5, h * 0.52, 3, INK); circle(ctx, w * 0.54, h * 0.52, 3, INK);
    person(ctx, w * 0.74, h * 0.8, h * 0.62, { kind: 'adult', shirt: '#e86fa0', t, wave: true, hair: '#2a1c14' });
    person(ctx, w * 0.86, h * 0.8, h * 0.66, { kind: 'adult', shirt: '#3b82f6', t, hair: '#1b1b1b', phase: 2 });
    if (s.era === 'future') { box(ctx, w * 0.2, h * 0.5, 38, 46, '#cfd8ff', 8); box(ctx, w * 0.2 - 8, h * 0.48 + 6, 54, 22, '#aab6f0', 6); circle(ctx, w * 0.2 + 19, h * 0.5 - 14, 14, '#e0e6ff'); label(ctx, '•ᴗ•', w * 0.2 + 19, h * 0.5 - 14, 11); box(ctx, w * 0.2 + 12, h * 0.5 + 46, 14, 40 + Math.sin(t * 3) * 3, '#8895d6', 3); }
    else person(ctx, w * 0.2, h * 0.8, h * 0.6, { kind: 'adult', shirt: '#7fd1c7', coat: true, t, cap: '#fff', phase: 1 });
    emoji(ctx, '🎈', w * 0.62, h * 0.22 + Math.sin(t * 2) * 6, 40);
  }
  function homeStreet(ctx, w, h, P, s, t) {
    sky(ctx, w, h, P, t); ground(ctx, w, h, h * 0.72, P.ground); ctx.fillStyle = '#7b7f8a'; ctx.fillRect(0, h * 0.84, w, h * 0.16);
    box(ctx, w * 0.06, h * 0.32, w * 0.28, h * 0.4, '#f6d7a7', 6); pen(ctx); ctx.beginPath(); ctx.moveTo(w * 0.03, h * 0.33); ctx.lineTo(w * 0.2, h * 0.12); ctx.lineTo(w * 0.37, h * 0.33); ctx.closePath(); fillStroke(ctx, P.accent);
    box(ctx, w * 0.16, h * 0.5, w * 0.07, h * 0.22, '#8b5a2b', 4); box(ctx, w * 0.09, h * 0.4, w * 0.05, h * 0.09, '#bfe6ff', 3);
    tree(ctx, w * 0.42, h * 0.74, 1.2);
    const by = h * 0.78 - Math.abs(Math.sin(t * 3)) * 26; emoji(ctx, '⚽', w * 0.66, by - 10, 28);
    person(ctx, w * 0.58, h * 0.8, h * 0.4, { kind: 'kid', shirt: '#22a6b3', t, walk: true, skin: SKIN[1] });
    person(ctx, w * 0.78, h * 0.8, h * 0.42, { kind: 'kid', shirt: '#f0932b', t, wave: true, phase: 3 });
    const ride = { past: '🐴', present: '🚗', future: '🛸' }[s.era]; emoji(ctx, ride, ((t * 40) % (w + 100)) - 50, h * 0.92, 40);
  }
  function classroom(ctx, w, h, P, s, t) {
    ctx.fillStyle = P.wall; ctx.fillRect(0, 0, w, h); ground(ctx, w, h, h * 0.8, '#c9a577');
    box(ctx, w * 0.2, h * 0.1, w * 0.6, h * 0.34, '#285a3c', 8); label(ctx, s.era === 'future' ? 'AI + 2 = ?' : 'A B C   1 + 1 = 2', w * 0.5, h * 0.22, 22, '#fffbe6'); pen(ctx, 3); ctx.beginPath(); ctx.moveTo(w * 0.24, h * 0.36); ctx.lineTo(w * 0.5, h * 0.36); ctx.strokeStyle = '#fffbe6'; ctx.stroke();
    emoji(ctx, '🕒', w * 0.9, h * 0.15, 32);
    person(ctx, w * 0.14, h * 0.82, h * 0.62, { kind: 'adult', shirt: '#8e44ad', wave: true, t, hair: '#222', skin: SKIN[1] });
    [0.34, 0.54, 0.74].forEach((fx, i) => { person(ctx, w * fx, h * 0.84, h * 0.4, { kind: 'kid', shirt: ['#f39c12', '#16a085', '#e74c3c'][i], t, phase: i, wave: i === 1 }); box(ctx, w * fx - 36, h * 0.7, 72, 12, '#a0703c', 3); box(ctx, w * fx - 30, h * 0.82, 6, h * 0.14, '#7a5430', 2); box(ctx, w * fx + 24, h * 0.82, 6, h * 0.14, '#7a5430', 2); });
  }
  function campus(ctx, w, h, P, s, t) {
    sky(ctx, w, h, P, t); ground(ctx, w, h, h * 0.76, P.ground);
    box(ctx, w * 0.22, h * 0.34, w * 0.56, h * 0.42, '#e9dcc3', 4); pen(ctx); ctx.beginPath(); ctx.arc(w * 0.5, h * 0.34, w * 0.12, Math.PI, 0); fillStroke(ctx, '#3b82f6');
    [0.28, 0.38, 0.62, 0.72].forEach((fx) => box(ctx, w * fx - 8, h * 0.44, 16, h * 0.32, '#fff', 3)); box(ctx, w * 0.45, h * 0.58, w * 0.1, h * 0.18, '#7a5430', 4);
    emoji(ctx, '🎓', w * 0.5, h * 0.2, 34); tree(ctx, w * 0.1, h * 0.8, 1.1); tree(ctx, w * 0.92, h * 0.8, 1);
    [0.3, 0.5, 0.7].forEach((fx, i) => person(ctx, ((fx * w + t * 14 * (i % 2 ? 1 : -1)) % w + w) % w, h * (0.86 + i * 0.02), h * 0.5, { kind: 'adult', shirt: ['#e84393', '#0984e3', '#00b894'][i], walk: true, t, phase: i }));
    emoji(ctx, '📚', w * 0.18, h * 0.9, 26);
  }
  function work(ctx, w, h, P, s, t) {
    const job = s.job || 'none';
    sky(ctx, w, h, P, t); ground(ctx, w, h, h * 0.78, job === 'pilot' ? '#8c8f9a' : '#9aa0a6');
    box(ctx, w * 0.12, h * 0.26, w * 0.5, h * 0.52, '#ece3d1', 6); box(ctx, w * 0.2, h * 0.18, w * 0.34, h * 0.14, P.accent, 6); emoji(ctx, JOB_ICON[job] || '💼', w * 0.37, h * 0.25, 34);
    [0.18, 0.34, 0.5].forEach((fx) => box(ctx, w * fx, h * 0.4, w * 0.08, h * 0.14, '#bfe6ff', 3)); box(ctx, w * 0.33, h * 0.6, w * 0.1, h * 0.18, '#7a5430', 4);
    const o = { kind: 'adult', t, wave: true, shirt: '#2d6cdf', skin: SKIN[2] };
    if (job === 'doctor') { o.coat = true; o.shirt = '#7fd1c7'; } if (job === 'police') { o.shirt = '#1e3a8a'; o.cap = '#1e3a8a'; } if (job === 'pilot') { o.shirt = '#111827'; o.cap = '#111827'; }
    if (job === 'teacher') o.shirt = '#8e44ad'; if (job === 'shopkeeper' || job === 'business') o.shirt = '#d35400';
    person(ctx, w * 0.74, h * 0.82, h * 0.7, o);
    if (job === 'pilot') emoji(ctx, '✈️', ((t * 60) % (w + 120)) - 60, h * 0.15, 46);
    if (job === 'police') emoji(ctx, '🚓', w * 0.9, h * 0.88, 44);
    if (job === 'engineer') emoji(ctx, '🏗️', w * 0.9, h * 0.62, 56);
    if (job === 'taxi') emoji(ctx, '🚕', ((t * 50) % (w + 120)) - 60, h * 0.9, 50);
    if (job === 'delivery') emoji(ctx, '🛵', ((t * 70) % (w + 120)) - 60, h * 0.9, 46);
    if (job === 'none') label(ctx, 'Kaam ki talash', w * 0.37, h * 0.9, 16);
    if (s.married) { person(ctx, w * 0.88, h * 0.83, h * 0.62, { kind: 'adult', shirt: '#e86fa0', t, phase: 2 }); }
  }
  function family(ctx, w, h, P, s, t) {
    sky(ctx, w, h, P, t); ground(ctx, w, h, h * 0.72, P.ground);
    box(ctx, w * 0.5, h * 0.3, w * 0.42, h * 0.42, '#f6d7a7', 6); pen(ctx); ctx.beginPath(); ctx.moveTo(w * 0.46, h * 0.31); ctx.lineTo(w * 0.71, h * 0.09); ctx.lineTo(w * 0.96, h * 0.31); ctx.closePath(); fillStroke(ctx, P.accent);
    box(ctx, w * 0.67, h * 0.5, w * 0.08, h * 0.22, '#8b5a2b', 4); tree(ctx, w * 0.06, h * 0.76, 1.1);
    person(ctx, w * 0.2, h * 0.82, h * 0.68, { kind: 'adult', shirt: '#3b82f6', t, wave: true });
    person(ctx, w * 0.32, h * 0.83, h * 0.62, { kind: 'adult', shirt: '#e86fa0', t, phase: 2 });
    for (let i = 0; i < Math.min(3, s.children || 0); i++) person(ctx, w * (0.42 + i * 0.07), h * 0.84, h * 0.34, { kind: 'kid', shirt: ['#f39c12', '#16a085', '#9b59b6'][i], t, walk: true, phase: i });
    emoji(ctx, '🏡', w * 0.1, h * 0.18, 30);
  }
  function senior(ctx, w, h, P, s, t) {
    sky(ctx, w, h, P, t, true); ground(ctx, w, h, h * 0.78, '#5d8a4a');
    box(ctx, w * 0.5, h * 0.4, w * 0.3, h * 0.38, '#f4ead7', 4); pen(ctx); ctx.beginPath(); ctx.arc(w * 0.65, h * 0.4, w * 0.1, Math.PI, 0); fillStroke(ctx, '#2e9e6a');
    box(ctx, w * 0.82, h * 0.2, 14, h * 0.58, '#f4ead7', 3); pen(ctx); ctx.beginPath(); ctx.arc(w * 0.82 + 7, h * 0.2, 11, Math.PI, 0); fillStroke(ctx, '#2e9e6a'); label(ctx, '☪', w * 0.65, h * 0.26, 22, '#fff');
    person(ctx, w * 0.22, h * 0.84, h * 0.58, { kind: 'old', shirt: '#f5f5f5', t });
    [0.38, 0.45].forEach((fx, i) => person(ctx, w * fx, h * 0.86, h * 0.3, { kind: 'kid', shirt: ['#f39c12', '#e84393'][i], t, walk: true, phase: i }));
    tree(ctx, w * 0.06, h * 0.8, 1.2);
  }

  const SCENES = { baby: hospital, child: homeStreet, school: classroom, college: campus, career: work, senior: senior };
  // drawScene paints the whole picture; "family" replaces the career scene once the player has children
  function drawScene(ctx, w, h, state, t) {
    const st = state || {}, P = PAL[st.era] || PAL.present;
    ctx.save(); ctx.clearRect(0, 0, w, h);
    const fn = st.stage === 'career' && st.children && st.view === 'family' ? family : (SCENES[st.stage] || homeStreet);
    fn(ctx, w, h, P, st, t || 0);
    ctx.restore();
  }
  return { drawScene, family, PAL, JOB_ICON, INK };
});
