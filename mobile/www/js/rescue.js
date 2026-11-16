// Rescue 1122: random street emergencies in the Live World.
// A road accident sets cars on fire at a crossing and people are trapped around it. A red beam and the minimap show where.
// Reach the place before time runs out (on foot, by car, bike or helicopter), press E next to a person to pick them up
// (carry up to 3), then bring them to the hospital next to the helipad. More lives saved = higher level = harder rescues.
// The numbers (time, people, rewards) are plain functions: tested in tests/rescue.test.js. create() is the 3D part.
import * as THREE from '/vendor/three/three.module.js';

const KEY = 'timewarp-rescue';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const LEVEL_MAX = 10;
export const MAX_CARRY = 3;
export const levelFor = (done) => Math.min(LEVEL_MAX, 1 + Math.floor(done / 3));
export const peopleCount = (level) => Math.min(4, 1 + Math.floor((level - 1) / 3));
export const timeLimit = (dist, level) => Math.round(Math.max(30, dist / 9 + 26 - level * 1.5));   // about walking speed on level 1, tighter later
export const nextDelay = (level, r) => Math.max(25, Math.round(70 - level * 3 + r * 40));          // seconds of calm before the next emergency
export function reward(level, saved, total, left, limit) {
  if (!saved) return 0;
  const all = saved === total;
  return (120 + level * 30) * saved + (all ? 100 + level * 20 : 0) + (all ? Math.round(clamp(left / Math.max(1, limit), 0, 1) * 150) : 0);
}
export function pickSite(sites, from, r) {              // a crossing that is not right next to the player
  const cross = sites.filter((s) => /crossing/.test(s.label));
  const pool = cross.length ? cross : sites;
  const far = pool.filter((s) => Math.hypot(s.x - from.x, s.z - from.z) >= 70);
  const list = far.length ? far : pool;
  return list[Math.floor(r() * list.length) % list.length];
}

export function create(ctx) {
  const { scene, say, puff, pos, addMoney, rnd, sites, hospital, solid, root, isBusy } = ctx;
  const collides = ctx.collides || (() => false);
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
  const lam = (color) => new THREE.MeshLambertMaterial({ color });

  let stats = { done: 0, lost: 0, saved: 0 }, enabled = true;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') { stats = { done: s.done | 0, lost: s.lost | 0, saved: s.saved | 0 }; enabled = s.enabled !== false; }
  } catch (e) { /* storage blocked: start fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...stats, enabled })); } catch (e) { /* ignore */ } };

  // ---------- the hospital (always there, next to the helipad) ----------
  const hosp = new THREE.Group(); hosp.position.set(hospital.x, 0, hospital.z);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const part = (g, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
  part(hosp, lam(0xf1f5f9), 0, 3, 0, 12, 6, 9); part(hosp, lam(0x94a3b8), 0, 6.15, 0, 12.4, 0.3, 9.4);
  const red = basic(0xdc2626);
  part(hosp, red, 0, 4.2, 4.52, 3.2, 0.9, 0.05); part(hosp, red, 0, 4.2, 4.52, 0.9, 3.2, 0.05);   // red cross on the front
  part(hosp, red, 0, 6.35, 0, 3.2, 0.05, 0.9); part(hosp, red, 0, 6.35, 0, 0.9, 0.05, 3.2);       // and on the roof
  part(hosp, lam(0x1e3a8a), 0, 1.2, 4.55, 2.2, 2.4, 0.1);                                          // door
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), basic(0x38bdf8)); beacon.position.set(0, 7, 0); hosp.add(beacon);
  scene.add(hosp);
  if (solid) solid(hospital.x, hospital.z, 12.8, 9.8);

  // ---------- markers ----------
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 80, 16, 1, true), basic(0xef4444, { transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(13, 0.5, 8, 40), basic(0xef4444, { transparent: true, opacity: 0.7 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3;
  beam.visible = ring.visible = false; scene.add(beam); scene.add(ring);

  // ---------- the people in trouble ----------
  const bodyGeo = new THREE.CylinderGeometry(0.28, 0.34, 1.0, 8), headGeo = new THREE.SphereGeometry(0.24, 10, 8), armGeo = new THREE.BoxGeometry(0.1, 0.7, 0.1);
  const skin = lam(0xd9a577), COLORS = [0x2563eb, 0x16a34a, 0xf59e0b, 0xdb2777, 0x7c3aed, 0x0891b2];
  function makeVictim(i) {
    const g = new THREE.Group(), cloth = lam(COLORS[i % COLORS.length]);
    const body = new THREE.Mesh(bodyGeo, cloth); body.position.y = 0.6; g.add(body);
    const head = new THREE.Mesh(headGeo, skin); head.position.y = 1.35; g.add(head);
    const arms = [0, 1].map((k) => { const p = new THREE.Group(); p.position.set(k ? 0.36 : -0.36, 1.05, 0); const a = new THREE.Mesh(armGeo, cloth); a.position.y = -0.35; p.add(a); g.add(p); return p; });
    g.userData.arms = arms; return g;
  }
  const burnt = lam(0x1b1b1b);

  // ---------- HUD ----------
  const hud = document.createElement('aside'); hud.setAttribute('aria-label', 'Rescue 1122'); hud.setAttribute('role', 'status');
  hud.style.cssText = 'position:absolute;right:12px;top:72px;z-index:6;max-width:220px;background:#0b1230d9;color:#fff;border:1px solid #ffffff33;border-radius:12px;padding:8px 12px;font:600 13px system-ui,sans-serif;line-height:1.35';
  hud.innerHTML = '<strong class="r-title" style="display:block;font-size:14px"></strong><span class="r-text"></span> <button type="button" class="link-btn small r-off" style="display:block;margin-top:4px">Rescue band karein</button>';
  if (root) root.appendChild(hud);
  const hT = hud.querySelector('.r-title'), hX = hud.querySelector('.r-text'), hB = hud.querySelector('.r-off');
  const idleHud = () => {
    hT.textContent = `🚑 Rescue 1122 · Level ${levelFor(stats.done)}`;
    hX.textContent = enabled ? `Sab theek hai. Bachaye: ${stats.saved}` : 'Band hai.';
    hB.textContent = enabled ? 'Rescue band karein' : 'Rescue chalu karein';
  };
  hB.addEventListener('click', () => {
    enabled = !enabled; persist();
    if (em) cleanup();
    idle = enabled ? 20 : 0; idleHud();
    say(enabled ? 'Rescue 1122 chalu: jald hi koi hadsa hoga.' : 'Rescue 1122 band hai.');
  });
  idleHud();

  let em = null, idle = 50, tt = 0, hudT = 0;
  const level = () => levelFor(stats.done);
  const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);

  function cleanup() {
    if (!em) return;
    em.objs.forEach((o) => scene.remove(o)); em = null; beam.visible = ring.visible = false;
  }
  function start() {
    const p = pos(), site = pickSite(sites, p, rnd), lv = level(), n = peopleCount(lv), limit = timeLimit(dist(p, site.x, site.z), lv);
    em = { site, level: lv, total: n, left: limit, limit, victims: [], carried: 0, saved: 0, lost: 0, emit: 0, objs: [], lastLeft: 0, finished: false };
    [[-3.2, 1.8, 0.4], [2.8, -2.2, -0.5]].forEach(([dx, dz, r]) => { const c = new THREE.Group(); part(c, burnt, 0, 0.55, 0, 4.2, 1.1, 1.9); part(c, burnt, -0.2, 1.3, 0, 2.2, 0.7, 1.7); c.position.set(site.x + dx, 0, site.z + dz); c.rotation.y = r; scene.add(c); em.objs.push(c); });
    for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
      const a = rnd() * 6.283, rr = 6 + rnd() * 5, x = site.x + Math.cos(a) * rr, z = site.z + Math.sin(a) * rr;
      if (collides(x, z)) continue;
      const m = makeVictim(i); m.position.set(x, 0, z); m.rotation.y = a + Math.PI; scene.add(m); em.objs.push(m);
      em.victims.push({ mesh: m, x, z, state: 'trapped', ph: rnd() * 6 }); i++;
    }
    em.total = em.victims.length;
    if (!em.total) { cleanup(); idle = 15; return; }
    beam.position.set(site.x, 40, site.z); ring.position.set(site.x, 0.3, site.z); beam.material.color.set(0xef4444); ring.material.color.set(0xef4444); beam.visible = ring.visible = true;
    say(`EMERGENCY! Road accident at ${site.label}, ${em.total} ${em.total > 1 ? 'log' : 'insan'} phanse hain. ${limit} second hain, jaldi pahunchein!`);
    hudT = 0;
  }
  function finish() {
    const e = em; e.finished = true;
    const rw = reward(e.level, e.saved, e.total, e.lastLeft, e.limit);
    const before = level();
    stats.saved += e.saved;
    if (e.saved > 0) { stats.done++; addMoney(rw); say(`Rescue mukammal! ${e.saved}/${e.total} bach gaye, +Rs ${rw}${e.saved === e.total ? ' (poora bonus!)' : ''}`); }
    else { stats.lost++; say('Koi nahi bach saka. Agli dafa jaldi pahunchein.'); }
    if (level() > before) say(`Rescue Level ${level()}! Ab hadse mushkil honge, lekin inaam bhi zyada.`);
    persist(); cleanup(); idle = nextDelay(level(), rnd()); idleHud();
  }

  function target(p) {
    if (!em || em.finished || em.carried >= MAX_CARRY) return null;
    let best = null, bd = 3.6;
    em.victims.forEach((v) => { if (v.state !== 'trapped') return; const d = Math.hypot(v.x - p.x, v.z - p.z); if (d < bd) { bd = d; best = { type: 'x-rescue', v, text: 'Press E to pick up the injured person' }; } });
    return best;
  }
  function act(tg) {
    if (!em || !tg.v || tg.v.state !== 'trapped') return;
    tg.v.state = 'carried'; tg.v.mesh.visible = false; em.carried++; em.lastLeft = em.left;
    const more = em.victims.filter((v) => v.state === 'trapped').length;
    say(`Insan uthaya (${em.carried} aap ke saath). ${more ? `${more} abhi bhi phanse hain.` : 'Ab hospital le jayein, helipad ke saath.'}`);
    if (!more) { beam.position.set(hospital.x, 40, hospital.z); ring.position.set(hospital.x, 0.3, hospital.z); beam.material.color.set(0x38bdf8); ring.material.color.set(0x38bdf8); }
  }

  function update(dt) {
    tt += dt; beacon.scale.setScalar(1 + 0.25 * Math.sin(tt * 5));
    if (!enabled) return;
    if (!em) { if (!isBusy()) idle -= dt; if (idle <= 0 && !isBusy()) start(); return; }
    const p = pos(), trapped = em.victims.filter((v) => v.state === 'trapped');
    if (trapped.length) em.left = Math.max(0, em.left - dt);
    ring.scale.setScalar(1 + 0.06 * Math.sin(tt * 4));
    em.emit -= dt;
    if (em.emit <= 0 && dist(p, em.site.x, em.site.z) < 280) {
      em.emit = 0.13; em.objs.slice(0, 2).forEach((c, i) => { puff(c.position.x, 0.9, c.position.z, true, 1.1); if (i === 0 || rnd() < 0.5) puff(c.position.x, 2, c.position.z, false, 1.6); });
    }
    em.victims.forEach((v) => {
      if (v.state !== 'trapped') return; v.ph += dt * 8; const w = Math.sin(v.ph) * 0.35, a = v.mesh.userData.arms;
      a[0].rotation.z = Math.PI - 0.45 + w; a[1].rotation.z = -(Math.PI - 0.45) - w;
    });
    if (trapped.length && em.left <= 0) {                           // time is up: the people still trapped are lost
      trapped.forEach((v) => { v.state = 'lost'; v.mesh.visible = false; em.lost++; });
      say(`Waqt khatam! ${trapped.length} ${trapped.length > 1 ? 'log' : 'insan'} nahi bach sake.`);
      if (em.carried) { beam.position.set(hospital.x, 40, hospital.z); ring.position.set(hospital.x, 0.3, hospital.z); beam.material.color.set(0x38bdf8); ring.material.color.set(0x38bdf8); }
    }
    if (em.carried > 0 && dist(p, hospital.x, hospital.z) < 13) {   // reached the hospital
      em.saved += em.carried; say(`Hospital pahunch gaye! ${em.carried} ${em.carried > 1 ? 'logon' : 'insan'} ki jaan bachi.`);
      em.victims.forEach((v) => { if (v.state === 'carried') v.state = 'safe'; }); em.carried = 0;
    }
    if (!em.victims.some((v) => v.state === 'trapped') && em.carried === 0) { finish(); return; }
    hudT -= dt;
    if (hudT <= 0) {
      hudT = 0.25; const left = em.victims.filter((v) => v.state === 'trapped').length;
      hT.textContent = `🚑 Rescue 1122 · Level ${em.level}`;
      hX.textContent = left ? `Phanse hue: ${left}${em.carried ? ` · Saath: ${em.carried}` : ''} · ${Math.ceil(em.left)}s` : `Hospital le jayein (${em.carried} saath), helipad ke qareeb`;
    }
  }
  function drawMap(mm, mx, w) {
    const px = (v) => clamp(mx(v), 7, w - 7), mark = (x, z, col, r) => { mm.fillStyle = col; mm.beginPath(); mm.arc(px(x), px(z), r, 0, 6.29); mm.fill(); };
    mark(hospital.x, hospital.z, '#38bdf8', 3.5);
    if (em && em.victims.some((v) => v.state === 'trapped')) mark(em.site.x, em.site.z, Math.sin(tt * 6) > 0 ? '#ef4444' : '#fca5a5', 5);
  }
  return { update, target, act, drawMap, get active() { return !!em; }, get stats() { return { ...stats, level: level() }; } };
}
