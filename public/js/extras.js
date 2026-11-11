// Live World extras: stop & drive cars, bike, helicopter, airplane, mosque with prayer, airfield, bigger land, sky, 1000 missions.
import * as THREE from '/vendor/three/three.module.js';

export function create(c) {
  const { scene, camera, renderer, mode, EX, LIM, player, makePerson, lam, basic, boxGeo, vehicles, solids, collides, tickerEl, bag, shopSpots, addMoney, setCam, getYaw, root, Missions } = c;
  const say = (t) => { if (tickerEl) tickerEl.textContent = t; };
  const rnd = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerpA = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  const cvs = (w, h) => { const e = document.createElement('canvas'); e.width = w; e.height = h; return [e, e.getContext('2d')]; };
  const tex = (e, rep) => { const t = new THREE.CanvasTexture(e); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t; };
  const add = (g, geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  const solid = (x, z, w, d) => solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

  // ---------- nicer light, sky, clouds, land ----------
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x55633f, mode === 'future' ? 0.45 : 0.55));
  if (scene.fog) scene.fog.density *= 0.55;
  camera.far = 1200; camera.updateProjectionMatrix();
  const horizon = new THREE.Color(scene.fog ? scene.fog.color : 0xbfd9ff), top = new THREE.Color(scene.background && scene.background.isColor ? scene.background : 0x4a90e2).multiplyScalar(0.75);
  const sg = new THREE.SphereGeometry(900, 24, 14), cols = [];
  const sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) { const k = clamp(sp.getY(i) / 900, 0, 1); const col = horizon.clone().lerp(top, Math.pow(k, 0.6)); cols.push(col.r, col.g, col.b); }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -1; scene.add(sky);
  const clouds = [], cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: mode === 'future' ? 0.25 : 0.8, depthWrite: false });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group(); for (let k = 0; k < 4; k++) add(g, new THREE.SphereGeometry(1, 8, 6), cloudMat, k * 9 - 14, rnd() * 3, rnd() * 8 - 4, 12 + rnd() * 8, 4 + rnd() * 3, 9 + rnd() * 5);
    g.position.set((rnd() - 0.5) * 900, 110 + rnd() * 80, (rnd() - 0.5) * 900); scene.add(g); clouds.push(g);
  }
  let landMesh = null, E = null;
  { // land around the town (grass / dry earth / dark metal)
    const [e, g] = cvs(256, 256), base = { present: '#4f7a3a', past: '#8a7a4a', future: '#27384d' }[mode];
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() < 0.5 ? '#00000014' : '#ffffff12'; g.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 5, 2 + rnd() * 5); }
    const land = new THREE.Mesh(new THREE.PlaneGeometry(LIM * 2 + 600, LIM * 2 + 600), lam(0xffffff, { map: tex(e, (LIM * 2 + 600) / 24) }));
    land.rotation.x = -Math.PI / 2; land.position.y = -0.06; scene.add(land); landMesh = land;
  }

  // ---------- airfield (west) ----------
  const AX = -(EX / 2 + 80), PADX = AX + 32, PADZ = -55;
  { const [e, g] = cvs(64, 700); g.fillStyle = '#2c2f36'; g.fillRect(0, 0, 64, 700);
    g.fillStyle = '#f5f5f5'; for (let y = 30; y < 680; y += 50) g.fillRect(30, y, 4, 26); g.fillRect(3, 0, 3, 700); g.fillRect(58, 0, 3, 700);
    for (let i = 0; i < 6; i++) { g.fillRect(12 + i * 8, 8, 4, 28); g.fillRect(12 + i * 8, 664, 4, 28); }
    add(scene, new THREE.PlaneGeometry(16, 170), lam(0xffffff, { map: tex(e) }), AX, 0.04, 0).rotation.x = -Math.PI / 2;
    const [h, q] = cvs(128, 128); q.fillStyle = '#3a3f4a'; q.beginPath(); q.arc(64, 64, 62, 0, 7); q.fill(); q.strokeStyle = '#facc15'; q.lineWidth = 5; q.beginPath(); q.arc(64, 64, 54, 0, 7); q.stroke();
    q.fillStyle = '#fff'; q.font = 'bold 70px sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('H', 64, 68);
    add(scene, new THREE.CircleGeometry(7, 28), lam(0xffffff, { map: tex(h) }), PADX, 0.05, PADZ).rotation.x = -Math.PI / 2;
    add(scene, boxGeo, lam(0x9aa3ad), AX - 24, 4, 25, 18, 8, 16); solid(AX - 24, 25, 18, 16);
    add(scene, boxGeo, lam(0x4b5563), AX - 24, 8.3, 25, 18.6, 0.6, 16.6);
  }

  // ---------- mosque (east): hall, dome, minarets, courtyard, congregation ----------
  const MX = EX / 2 + 75, MZ = 0, HX0 = MX - 17, HX1 = MX + 9, HZ = 16, WH = 8;
  const stone = lam(mode === 'future' ? 0xdfe9f5 : 0xf1ead8), trim = lam(0xc9a227), domeMat = lam(mode === 'future' ? 0x7dd3fc : 0x2f7d5b, { emissive: 0x0a2418, emissiveIntensity: 0.25 });
  { const [e, g] = cvs(256, 256); g.fillStyle = '#d8cfb8'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#b9ad90'; g.lineWidth = 2; for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
    add(scene, new THREE.PlaneGeometry(64, 70), lam(0xffffff, { map: tex(e, 4) }), MX + 12, 0.03, MZ).rotation.x = -Math.PI / 2; }
  { const [e, g] = cvs(512, 640); g.fillStyle = '#1f5f45'; g.fillRect(0, 0, 512, 640);   // carpet: one prayer mat per place (x = across the picture, z = down)
    g.strokeStyle = '#d9c36a'; g.lineWidth = 3; for (let r = 0; r < 12; r++) for (let k = 0; k < 15; k++) { g.strokeRect(r * 42.6 + 6, k * 42.6 + 6, 30, 30); g.beginPath(); g.arc(r * 42.6 + 21, k * 42.6 + 14, 4, 0, 7); g.stroke(); }
    add(scene, new THREE.PlaneGeometry(HX1 - HX0 - 1, HZ * 2 - 1), lam(0xffffff, { map: tex(e) }), (HX0 + HX1) / 2, 0.05, MZ).rotation.x = -Math.PI / 2; }
  const wall = (x, z, w, d) => { add(scene, boxGeo, stone, x, WH / 2, z, w, WH, d); solid(x, z, w, d); };
  wall(HX0, MZ, 1, HZ * 2); wall((HX0 + HX1) / 2, MZ - HZ, HX1 - HX0, 1); wall((HX0 + HX1) / 2, MZ + HZ, HX1 - HX0, 1);
  add(scene, boxGeo, trim, (HX0 + HX1) / 2, WH + 0.1, MZ, HX1 - HX0 + 1.2, 0.5, HZ * 2 + 1.2);
  add(scene, boxGeo, stone, (HX0 + HX1) / 2, WH + 0.6, MZ, HX1 - HX0, 0.8, HZ * 2);
  add(scene, new THREE.SphereGeometry(8.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, (HX0 + HX1) / 2, WH + 1, MZ, 1, 0.85, 1);
  add(scene, new THREE.ConeGeometry(0.35, 3.4, 8), trim, (HX0 + HX1) / 2, WH + 9.2, MZ);
  for (let i = -1; i <= 1; i += 2) add(scene, new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, (HX0 + HX1) / 2 + 0, WH + 1, MZ + i * 11.5, 1, 0.8, 1);
  for (let k = -3; k <= 3; k++) { add(scene, new THREE.CylinderGeometry(0.45, 0.5, WH, 10), stone, HX1, WH / 2, MZ + k * 4.6); add(scene, new THREE.SphereGeometry(0.6, 8, 6), trim, HX1, WH, MZ + k * 4.6); }
  for (let k = -3; k <= 2; k++) add(scene, new THREE.TorusGeometry(2.0, 0.22, 6, 14, Math.PI), trim, HX1, WH - 2.1, MZ + k * 4.6 + 2.3).rotation.y = Math.PI / 2;
  [[HX1 + 1, MZ - HZ - 1], [HX1 + 1, MZ + HZ + 1], [HX0 - 1, MZ - HZ - 1], [HX0 - 1, MZ + HZ + 1]].forEach(([x, z]) => {
    add(scene, new THREE.CylinderGeometry(1.1, 1.4, 24, 14), stone, x, 12, z); add(scene, new THREE.CylinderGeometry(1.9, 1.9, 0.7, 14), trim, x, 20, z);
    add(scene, new THREE.ConeGeometry(1.5, 4.5, 14), domeMat, x, 26.2, z); add(scene, new THREE.SphereGeometry(0.3, 8, 6), trim, x, 28.8, z); solid(x, z, 2.8, 2.8);
  });
  add(scene, boxGeo, lam(0x14110d), HX0 + 0.55, 2.4, MZ, 0.2, 4.8, 3.4); add(scene, boxGeo, trim, HX0 + 0.5, 5.0, MZ, 0.2, 0.35, 4.2);   // mihrab niche (the qibla wall faces west)
  const lamp = new THREE.PointLight(0xffe2b0, 0.9, 40); lamp.position.set((HX0 + HX1) / 2, 6.5, MZ); scene.add(lamp);
  const mkWorshipper = (x, z) => { const p = makePerson({ shirt: 0xf3f1e8, pants: 0xf3f1e8, long: true, hair: 0x15110d, skin: [0xd9a37e, 0xb97a56, 0x8d5a3c][Math.floor(rnd() * 3)] }); p.group.rotation.order = 'YXZ'; scene.add(p.group); return { p, x, z, pose: { ...POSES.qiyam } }; };
  const POSES = { qiyam: { th: 0, hip: 0.86, leg: 0, arm: -0.75 }, ruku: { th: 1.45, hip: 0.86, leg: 0, arm: 0.1 }, qawma: { th: 0, hip: 0.86, leg: 0, arm: 0 }, sujood: { th: 1.35, hip: 0.2, leg: 1.45, arm: 0.2 }, jalsa: { th: 0.05, hip: 0.28, leg: 1.45, arm: -0.5 } };
  const SEQ = [['qiyam', 4], ['ruku', 2.5], ['qawma', 1.5], ['sujood', 2.5], ['jalsa', 1.5], ['sujood', 2.5]], CYC = SEQ.reduce((a, s) => a + s[1], 0), WEST = -Math.PI / 2;
  const slotX = MX - 4, slotZ = MZ;
  const crowd = [mkWorshipper(MX - 13, MZ)];   // the imam stands in front
  [MX - 9, MX - 6.5].forEach((x) => [-6, -4, -2, 2, 4, 6].forEach((dz) => crowd.push(mkWorshipper(x, MZ + dz))));
  [-6, -4, 4, 6].forEach((dz) => crowd.push(mkWorshipper(slotX, MZ + dz)));
  const poseTo = (ps, name, k) => { const T = POSES[name]; ['th', 'hip', 'leg', 'arm'].forEach((f) => { ps[f] += (T[f] - ps[f]) * k; }); };
  function applyPose(p, x, z, yaw, ps) {
    const a = 0.86 * Math.cos(ps.th), b = 0.86 * Math.sin(ps.th);
    p.group.rotation.set(ps.th, yaw, 0); p.group.position.set(x - b * Math.sin(yaw), ps.hip - a, z - b * Math.cos(yaw));
    p.legL.rotation.x = p.legR.rotation.x = ps.leg - ps.th; p.armL.rotation.x = p.armR.rotation.x = ps.arm - ps.th;
  }
  player.group.rotation.order = 'YXZ';

  // ---------- vehicles: bike, helicopter, airplane ----------
  const blk = lam(0x15110d), glass = lam(0x1b2a3a);
  const paintMats = [];   // the frame / body colours the player can change (Car colour)
  function makeBike() {
    const g = new THREE.Group(), fm = lam(0xdc2626), wh = []; paintMats.push(fm);
    [0.6, -0.6].forEach((x) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 6, 16), blk); w.position.set(x, 0.4, 0); g.add(w); wh.push(w); });
    add(g, boxGeo, fm, 0, 0.62, 0, 1.2, 0.06, 0.06).rotation.z = 0.15; add(g, boxGeo, fm, 0.6, 0.55, 0, 0.06, 0.7, 0.06).rotation.z = -0.3;
    add(g, boxGeo, blk, 0.52, 0.95, 0, 0.06, 0.06, 0.6); add(g, boxGeo, blk, -0.35, 0.85, 0, 0.3, 0.06, 0.2);
    g.userData = { wheels: wh, kind: 'bike' }; return g;
  }
  function makePlane() {
    const g = new THREE.Group(), w = lam(0xf3f4f6), r = lam(0xdc2626); paintMats.push(r);
    add(g, boxGeo, w, 0, 1.3, 0, 7, 1.1, 1.1); add(g, boxGeo, r, 0.3, 1.35, 0, 1.6, 0.12, 10); add(g, boxGeo, r, -3.2, 2.05, 0, 1, 1.4, 0.12); add(g, boxGeo, r, -3.2, 1.5, 0, 0.9, 0.1, 3.4);
    add(g, new THREE.ConeGeometry(0.55, 1.2, 12), w, 4.0, 1.3, 0).rotation.z = -Math.PI / 2; add(g, boxGeo, glass, 1.0, 1.9, 0, 1.4, 0.5, 0.9);
    [[1.2, 0.8], [1.2, -0.8], [-2.8, 0]].forEach(([x, z]) => { const t = add(g, new THREE.CylinderGeometry(0.4, 0.4, 0.25, 12), blk, x, 0.4, z); t.rotation.x = Math.PI / 2; });
    const pr = new THREE.Group(); pr.position.set(4.7, 1.3, 0); add(pr, boxGeo, blk, 0, 0, 0, 0.08, 2.4, 0.2); g.add(pr);
    g.userData = { prop: pr, kind: 'plane' }; return g;
  }
  function makeHeli() {
    const g = new THREE.Group(), b = lam(0xe11d48), sphere = new THREE.SphereGeometry(1, 16, 12);
    paintMats.push(b); add(g, sphere, b, 0, 1.6, 0, 2.0, 1.0, 1.0); add(g, sphere, lam(0x9be7ff), 1.0, 1.8, 0, 1.0, 0.7, 0.8); add(g, boxGeo, b, -3.0, 1.9, 0, 3.6, 0.3, 0.3); add(g, boxGeo, b, -4.7, 2.3, 0, 0.4, 1.0, 0.12);
    add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), blk, 0, 2.8, 0); [-0.8, 0.8].forEach((z) => { add(g, boxGeo, blk, 0, 0.3, z, 3, 0.08, 0.08); add(g, boxGeo, blk, 0.7, 0.8, z, 0.06, 1.0, 0.06); add(g, boxGeo, blk, -0.7, 0.8, z, 0.06, 1.0, 0.06); });
    const rotor = new THREE.Group(); rotor.position.y = 3.1; add(rotor, boxGeo, blk, 0, 0, 0, 8, 0.06, 0.4); add(rotor, boxGeo, blk, 0, 0, 0, 0.4, 0.06, 8); g.add(rotor);
    const tail = new THREE.Group(); tail.position.set(-4.7, 2.4, 0.2); add(tail, boxGeo, blk, 0, 0, 0, 0.08, 1.2, 0.12); g.add(tail);
    g.userData = { rotor, tail, kind: 'heli' }; return g;
  }
  const SPEC = {   // max speed, boost, acceleration, friction, turn rate, reverse, camera distance, length for the bump test
    car: { max: 16, boost: 26, acc: 12, fric: 5, turn: 1.9, back: 6, dist: 9, len: 2.2 }, bike: { max: 9, boost: 14, acc: 8, fric: 4, turn: 2.4, back: 2, dist: 6.5, len: 0.9 },
    heli: { max: 20, boost: 34, acc: 9, fric: 3, turn: 1.6, back: 6, dist: 15, len: 3 }, plane: { max: 40, boost: 60, acc: 14, fric: 0.6, turn: 0.9, back: 0, dist: 20, len: 4 },
  };
  const HP = { bike: 0, heli: 3, plane: 3, car: 5 };       // hits a vehicle survives; the last hit sets it on fire
  const rides = [];
  const spawn = (obj, label, x, z, r, y = 0) => { obj.position.set(x, y, z); obj.rotation.order = 'YXZ'; obj.rotation.y = r; scene.add(obj); const rec = { obj, kind: obj.userData.kind, label, x, z, r, y, hp: HP[obj.userData.kind], max: HP[obj.userData.kind] }; rides.push(rec); return rec; };
  const spawnRide = (kind, x, z, r) => spawn(kind === 'plane' ? makePlane() : makeHeli(), kind === 'plane' ? 'airplane' : 'helicopter', x, z, r);
  const removeRide = (rec) => { if (drv && drv.rec === rec) return; scene.remove(rec.obj); const i = rides.indexOf(rec); if (i >= 0) rides.splice(i, 1); hazards.delete(rec); };
  [[SW0(), 3], [SW0(), -3], [-SW0(), 3], [-SW0(), -3]].forEach(([x, z], i) => spawn(makeBike(), 'bike', x, z, Math.PI / 2 * (i % 2 ? 1 : 3)));
  function SW0() { return 7.75 + 0.9; }
  spawn(makeHeli(), 'helicopter', PADX, PADZ, Math.PI / 2); spawn(makePlane(), 'airplane', AX, 62, Math.PI / 2);
  const CARNAME = mode === 'past' ? 'tonga' : mode === 'future' ? 'hover pod' : 'car';

  // ---------- state: driving, praying, drivers running away ----------
  let drv = null, praying = null, tt = 0, prevCyc = 0, nearPrompt = null; const drivers = [], kv = new Set(); let fakeP = { th: 0, hip: 0.86, leg: 0, arm: 0 };
  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
  addEventListener('keydown', (e) => {
    if (typing()) return;
    if (e.code === 'Space') { kv.add('up'); if (drv) e.preventDefault(); } if (e.code === 'KeyC') kv.add('down');
    if (e.key === 'Escape' && praying) stopPray();
  });
  addEventListener('keyup', (e) => { if (e.code === 'Space') kv.delete('up'); if (e.code === 'KeyC') kv.delete('down'); });
  addEventListener('blur', () => kv.clear());
  const actions = root.querySelector('.world-actions'), flyBtns = [['▲ Up', 'up'], ['▼ Down', 'down']].map(([txt, k]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.textContent = txt; b.style.display = 'none';
    b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); kv.add(k); }); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => kv.delete(k)));
    if (actions) actions.appendChild(b); return b;
  });
  const inMosque = (p) => Math.abs(p.x - (MX + 6)) < 44 && Math.abs(p.z - MZ) < 38;

  let paint = null;
  function paintCar(obj) {   // present-day cars: the body is the first part of the car; give this car its own paint
    if (!paint || mode !== 'present' || !obj.children[0] || !obj.children[0].material || !obj.children[0].material.color) return;
    const m = obj.children[0].material.clone(); m.color.set(paint); obj.children[0].material = m;
  }
  function setPaint(hex) { paint = hex; paintMats.forEach((m) => m.color.set(hex)); }
  // ---------- smoke, fire, damage ----------
  const hazards = new Set(), puffs = []; let shake = 0, standingOn = null;
  const hpEl = document.createElement('div'); hpEl.hidden = true; hpEl.setAttribute('role', 'status');
  hpEl.style.cssText = 'position:absolute;left:50%;bottom:112px;transform:translateX(-50%);z-index:6;background:#0b1230d9;color:#fff;border:1px solid #ffffff33;border-radius:999px;padding:5px 14px;font:700 15px system-ui,sans-serif;pointer-events:none'; root.appendChild(hpEl);
  const puffTex = (inner, outer) => { const [e, g] = cvs(64, 64), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(e); };
  const fireMat = new THREE.SpriteMaterial({ map: puffTex('#fff3b0', '#ff400000'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), smokeMat = new THREE.SpriteMaterial({ map: puffTex('#555555ee', '#33333300'), transparent: true, depthWrite: false });
  function puff(x, y, z, fire, big = 1) {
    let q = puffs.length < 70 ? null : puffs.find((p) => !p.sp.visible) || puffs.shift();
    if (!q) { q = { sp: new THREE.Sprite(fire ? fireMat : smokeMat), t: 0, life: 1, vy: 3, grow: 1 }; scene.add(q.sp); puffs.push(q); }
    q.sp.material = fire ? fireMat : smokeMat; q.t = 0; q.life = fire ? 0.7 + rnd() * 0.4 : 1.6 + rnd(); q.vy = (fire ? 4 : 3) + rnd() * 2; q.grow = (fire ? 5 : 7) * big; q.sp.position.set(x + (rnd() - 0.5) * 1.5, y, z + (rnd() - 0.5) * 1.5); q.sp.scale.setScalar(1.5 * big); q.sp.visible = true; if (!puffs.includes(q)) puffs.push(q);
  }
  function showHp() {
    if (!drv || !drv.rec || !drv.rec.max) { hpEl.hidden = true; return; }
    const r = drv.rec; hpEl.hidden = false; hpEl.textContent = `${{ plane: '✈ Aeroplane', heli: '🚁 Helicopter', car: '🚗 ' + CARNAME }[drv.kind]}: ${'♥'.repeat(Math.max(0, r.hp))}${'♡'.repeat(Math.max(0, r.max - r.hp))}${r.burning ? '  🔥 ON FIRE!' : ''}`;
  }
  function damage(d, n, why) {
    const r = d.rec; if (!r || !r.max || d.immune > 0 || r.burning) return; d.immune = 0.9; shake = 0.7; r.hp = Math.max(0, r.hp - n); hazards.add(r);
    if (r.hp <= 0) { r.burning = true; r.burnT = 0; say(`${why === 'hard landing' ? 'Hard landing' : 'Crash'}! The ${d.label} is ON FIRE! ${d.alt > d.gh + 2 ? 'The engine is dead, land it now!' : 'Get out!'}`); }
    else say(`${why === 'hard landing' ? 'Hard landing' : why === 'accident' ? 'Accident' : 'Crash'}! ${d.label} health ${r.hp}/${r.max}. ${r.hp === 1 ? 'One more hit and it catches fire.' : ''}`);
    showHp();
  }
  function wreck(r, label) {
    r.wrecked = true; r.burning = false; r.obj.visible = false; r.respawn = tt + 25; const o = r.obj.position; for (let i = 0; i < 14; i++) puff(o.x, o.y + 1 + i * 0.4, o.z, i % 2 === 0, 3);
    if (drv && drv.rec === r) { const d = drv; stopDrive(true); say(`Your ${label || d.label} exploded! You jumped out just in time.`); } hpEl.hidden = true;
  }
  function restore(r) { r.wrecked = false; r.burning = false; r.hp = r.max; r.wreck = null; hazards.delete(r); if (r.obj.userData.kind === 'plane' || r.obj.userData.kind === 'heli' || r.obj.userData.kind === 'bike') r.obj.position.set(r.x, r.y || 0, r.z); r.obj.rotation.set(0, r.r || 0, 0); r.obj.visible = true; r.held = false; }

  // ---------- ground under a point: terrain, or the flat roof of a building you are above ----------
  const terr = (x, z) => (E ? E.heightAt(x, z) : 0);
  function roofAt(x, z, alt) { let best = null; for (let i = 0; i < solids.length; i++) { const s = solids[i]; if (s.roof && s.h <= alt + 1.2 && x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && (!best || s.h > best.h)) best = s; } return best; }
  function hitSolid(x, z, alt) { for (let i = 0; i < solids.length; i++) { const s = solids[i]; if (x > s.minX - 0.5 && x < s.maxX + 0.5 && z > s.minZ - 0.5 && z < s.maxZ + 0.5 && alt < (s.h === undefined ? 40 : s.h) - 0.15) return s; } return null; }

  function startDrive(kind, obj, rec, label) {
    obj.rotation.order = 'YXZ'; if (kind === 'car') paintCar(obj);
    rec = rec || {}; if (rec.hp === undefined) { rec.hp = HP[kind]; rec.max = HP[kind]; } if (rec.wrecked) { say('That one is wrecked. A new one will appear soon.'); return; }
    standingOn = null;
    drv = { kind, obj, rec, label, speed: 0, alt: obj.position.y, gh: obj.position.y, x: obj.position.x, z: obj.position.z, r: obj.rotation.y, roll: 0, immune: 0 };
    player.group.visible = kind === 'bike'; flyBtns.forEach((b) => { b.style.display = kind === 'heli' || kind === 'plane' ? '' : 'none'; });
    say(`You are in the ${label}. W/S gas & brake, A/D steer, Shift boost${kind === 'heli' || kind === 'plane' ? ', Space up, C down. The higher you fly, the faster you go. Press M for the world map' : ''}. Press E to get out.`); showHp();
  }
  function stopDrive(force) {
    const d = drv, rf = roofAt(d.x, d.z, d.alt), floor = Math.max(terr(d.x, d.z), rf ? rf.h : 0);
    if (!force && d.alt > floor + 1.5) { say('Land first, then get out.'); return; }
    if (!force && E && E.isWater(d.x, d.z) && d.kind !== 'bike' && d.kind !== 'car') { say('You cannot get out on the open sea. Fly to land first.'); return; }
    if (rf && d.alt <= floor + 1.5) {                         // parked on a roof: step out onto it
      standingOn = rf; player.group.position.set(clamp(d.x + 1.5, rf.minX + 0.6, rf.maxX - 0.6), rf.h, clamp(d.z + 1.5, rf.minZ + 0.6, rf.maxZ - 0.6)); say('You are on the roof. Press E near the edge to climb down.');
    } else {
      const sx = Math.sin(d.r) * 2.4, sz = Math.cos(d.r) * 2.4, bad = collides(d.x + sx, d.z + sz);
      player.group.position.set(bad ? d.x : d.x + sx, floor, bad ? d.z : d.z + sz);
    }
    player.group.visible = true; player.group.rotation.set(0, d.r + Math.PI / 2, 0);
    d.obj.rotation.x = 0; d.obj.rotation.z = 0; drv = null; flyBtns.forEach((b) => { b.style.display = 'none'; }); hpEl.hidden = true; setCam(undefined, 5.2);
  }
  function climbDown() {
    const s = standingOn, p = player.group.position; if (!s) return;
    for (const [x, z] of [[(s.minX + s.maxX) / 2, s.maxZ + 2.2], [(s.minX + s.maxX) / 2, s.minZ - 2.2], [s.maxX + 2.2, (s.minZ + s.maxZ) / 2], [s.minX - 2.2, (s.minZ + s.maxZ) / 2]]) if (!collides(x, z)) { p.set(x, terr(x, z), z); break; }
    standingOn = null; say('You climbed down the stairs to the street.');
  }
  function pullDriver(v) {
    v.held = true; const o = v.obj, r = o.rotation.y, side = rnd() < 0.5 ? 1 : -1;
    const p = makePerson({ shirt: [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b][Math.floor(rnd() * 4)], pants: 0x1f2937, hair: 0x15110d, skin: 0xb97a56 }); scene.add(p.group);
    p.group.position.set(o.position.x + Math.sin(r) * 1.6 * side, 0, o.position.z + Math.cos(r) * 1.6 * side);
    drivers.push({ p, dx: Math.sin(r) * side, dz: Math.cos(r) * side, t: 0 });
    say(`You stopped the ${CARNAME} and pulled the driver out. He ran off shouting "Arre, meri gaari!" The ${CARNAME} is yours.`);
  }
  function startPray() {
    praying = { ps: { ...POSES.qiyam }, since: tt }; player.group.visible = true; player.group.position.set(slotX, 0, slotZ); say('You joined the congregation. Move or press E to finish.');
  }
  function stopPray() { praying = null; const p = player; p.group.rotation.set(0, WEST, 0); p.group.position.set(slotX + 3, 0, slotZ); p.legL.rotation.x = p.legR.rotation.x = p.armL.rotation.x = p.armR.rotation.x = 0; }

  // ---------- missions ----------
  const lms = [{ label: 'the mosque courtyard', x: MX + 22, z: MZ, open: true }, { label: 'the airfield runway', x: AX, z: 30, open: true }, { label: 'the helipad', x: PADX, z: PADZ, open: true },
    { label: 'the town centre crossing', x: 11, z: 11, open: true }, { label: 'the north-west crossing', x: -99, z: -99, open: true }, { label: 'the north-east crossing', x: 99, z: -99, open: true },
    { label: 'the south-west crossing', x: -99, z: 99, open: true }, { label: 'the south-east crossing', x: 99, z: 99, open: true }];
  shopSpots.slice(0, 14).forEach((s) => lms.push({ label: `the door of ${s.name}`, x: s.x, z: s.z }));
  const KEY = 'timewarp-mission'; let idx = 0, cur = null, queue = [], coinMeshes = [], hudT = 0, doneUntil = 0;
  try { idx = clamp(parseInt(localStorage.getItem(KEY) || '0', 10) || 0, 0, Missions.TOTAL - 1); } catch (e) { /* storage blocked: start at 1 */ }
  const hud = document.createElement('aside'); hud.className = 'mission'; hud.setAttribute('aria-label', 'Mission'); hud.innerHTML = '<strong class="m-title"></strong><span class="m-text"></span><span class="m-meta"></span><button type="button" class="link-btn small m-skip">Skip mission</button>';
  root.appendChild(hud); const hT = hud.querySelector('.m-title'), hX = hud.querySelector('.m-text'), hM = hud.querySelector('.m-meta');
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 70, 16, 1, true), basic(0xfacc15, { transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })); beam.visible = false; scene.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(20, 1.1, 8, 36), basic(0xfacc15, { transparent: true, opacity: 0.7 })); ring.visible = false; scene.add(ring);
  const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 14), coinMat = basic(0xfacc15);
  const pos = () => player.group.position, kindNow = () => (drv ? drv.kind : 'foot');
  function startMission() {
    coinMeshes.forEach((m) => scene.remove(m)); coinMeshes = [];
    if (idx >= Missions.TOTAL) { cur = null; hT.textContent = 'All 1000 missions complete!'; hX.textContent = 'You are a TimeWarp legend.'; hM.textContent = ''; beam.visible = ring.visible = false; return; }
    cur = Missions.generate(idx, lms); cur.p = 0; cur.t = 0;
    if (cur.slack) { const d = Math.hypot(pos().x - cur.target.x, pos().z - cur.target.z); cur.time = Math.ceil((d / (cur.type === 'run' ? 5.5 : 14)) * cur.slack + 8); }
    if (cur.type === 'coins') for (let k = 0, tries = 0; k < cur.goal && tries < 400; tries++) {
      const a = rnd() * 6.28, rr = 4 + rnd() * 12, x = cur.target.x + Math.cos(a) * rr, z = cur.target.z + Math.sin(a) * rr;
      if (collides(x, z) || Math.abs(x) > LIM - 4 || Math.abs(z) > LIM - 4) continue;
      const m = new THREE.Mesh(coinGeo, coinMat); m.rotation.x = Math.PI / 2; m.position.set(x, 1.1, z); scene.add(m); coinMeshes.push(m); k++;
    }
    hT.textContent = cur.title; hX.textContent = cur.text; hudT = 0;
  }
  hud.querySelector('.m-skip').addEventListener('click', () => { idx++; try { localStorage.setItem(KEY, String(idx)); } catch (e) { /* ignore */ } document.dispatchEvent(new Event('timewarp:progress')); startMission(); });
  function missionTick(dt) {
    if (!cur) return;
    if (tt < doneUntil) return;
    const st = { x: pos().x, z: pos().z, veh: kindNow(), alt: drv ? drv.alt : 0 };
    coinMeshes = coinMeshes.filter((m) => { if (Math.hypot(m.position.x - st.x, m.position.z - st.z) < 2.4 && Math.abs(st.alt - 1) < 4) { scene.remove(m); queue.push('coin'); return false; } m.rotation.z += dt * 3; return true; });
    let res = null; while (queue.length && !res) res = Missions.advance(cur, st, queue.shift(), 0); queue = [];
    res = res || Missions.advance(cur, st, null, dt);
    if (res === 'done') { addMoney(cur.reward); say(`Mission complete! +Rs ${cur.reward}`); idx++; try { localStorage.setItem(KEY, String(idx)); } catch (e) { /* ignore */ } document.dispatchEvent(new Event('timewarp:progress')); hT.textContent = 'Mission complete!'; hX.textContent = `+Rs ${cur.reward}. Next mission in a moment…`; doneUntil = tt + 2.5; cur = null; setTimeout(() => { doneUntil = 0; startMission(); }, 2500); return; }
    if (res === 'fail') { say('Time is up! Try the mission again.'); startMission(); return; }
    const tg = cur.target || (cur.type === 'pray' ? { x: slotX, z: slotZ } : null);
    beam.visible = !!tg; ring.visible = !!tg && cur.type === 'plane';
    if (tg) { beam.position.set(tg.x, 35, tg.z); beam.scale.set(1 + Math.sin(tt * 3) * 0.1, 1, 1 + Math.sin(tt * 3) * 0.1); ring.position.set(tg.x, 30, tg.z); }
    hudT -= dt; if (hudT > 0) return; hudT = 0.25;
    const d = tg ? Math.round(Math.hypot(st.x - tg.x, st.z - tg.z)) : null;
    hM.textContent = [d !== null ? `GPS: ${d} m away, about ${d < 40 ? Math.max(1, Math.ceil(d / 2.6)) + ' s' : Math.ceil(d / 2.6 / 60 * 10) / 10 + ' min'} on foot` : '', ['coins', 'pray', 'talk', 'shop', 'buy', 'wave', 'dance', 'photo'].includes(cur.type) ? `${cur.p}/${cur.goal}` : '', cur.time ? `${Math.max(0, Math.ceil(cur.time - cur.t))} s left` : '', `Reward Rs ${cur.reward}`].filter(Boolean).join(' · ');
  }

  // ---------- per-frame ----------
  function crashInto(v, d) {            // you drove into another car: both are knocked about
    const dx = v.obj.position.x - d.x, dz = v.obj.position.z - d.z, L = Math.hypot(dx, dz) || 1, sp = Math.abs(d.speed), n = sp > 12 ? 2 : 1;
    v.held = true; v.wreck = { vx: (dx / L) * sp * 0.9, vz: (dz / L) * sp * 0.9, spin: (rnd() - 0.5) * 7, t: 0 };
    if (v.hp === undefined) { v.hp = HP.car; v.max = HP.car; } v.hp = Math.max(0, v.hp - n); hazards.add(v); if (v.hp <= 0) { v.burning = true; v.burnT = 0; }
    d.speed *= -0.3; d.x -= (dx / L) * 1.2; d.z -= (dz / L) * 1.2; damage(d, n, 'accident'); say(`Accident! You crashed into another ${CARNAME}${v.burning ? ' and it caught fire!' : '.'}`);
  }
  function drive(dt, dirs) {
    const d = drv, K = SPEC[d.kind], air = d.kind === 'heli' || d.kind === 'plane', rec = d.rec;
    const f0 = (dirs.has('f') ? 1 : 0) - (dirs.has('b') ? 1 : 0), s = (dirs.has('l') ? 1 : 0) - (dirs.has('r') ? 1 : 0), boost = dirs.has('run'), up = kv.has('up') ? 1 : 0, dn = kv.has('down') ? 1 : 0;
    d.immune = Math.max(0, d.immune - dt);
    const dead = !!rec.max && (rec.burning || rec.hp <= 0), f = dead ? 0 : f0, onGround = d.alt <= d.gh + 0.08;
    const cap = (boost ? K.boost : K.max) + (air ? d.alt * (d.kind === 'plane' ? 0.4 : 0.12) * (boost ? 1.4 : 1) : 0);
    const fric = d.kind === 'plane' && onGround && d.gh > 0.5 ? 8 : K.fric;
    if (f > 0) d.speed += K.acc * dt * (boost ? 1.6 : 1) * (air && d.kind === 'plane' ? 1 + d.alt * 0.004 : 1); else if (f < 0) d.speed -= (d.speed > 0 ? K.acc * 1.6 : K.acc * 0.7) * dt; else d.speed -= Math.sign(d.speed) * Math.min(Math.abs(d.speed), (dead && !air ? 9 : fric) * dt);
    d.speed = clamp(d.speed, -K.back, cap); if (dead && air) d.speed *= 1 - 0.25 * dt;
    d.r += s * K.turn * (air ? 1 : Math.min(1, Math.abs(d.speed) / 5)) * (d.speed < 0 ? -1 : 1) * dt;
    const prevAlt = d.alt, ceil = d.kind === 'plane' ? 2600 : d.kind === 'heli' ? 500 : 0;
    if (d.kind === 'heli') d.alt += (dead ? -9 : (up - dn) * (7 + d.alt * 0.02)) * dt;
    else if (d.kind === 'plane') { if (!onGround) d.alt += ((up - dn) * (8 + Math.abs(d.speed) * 0.1) - (d.speed < 12 ? 6 : 0) - (dead ? 12 : 0)) * dt; else if (up && d.speed >= 16 && !dead) d.alt = d.gh + 0.2; }
    if (air) d.alt = Math.min(d.alt, ceil);
    const fx = Math.cos(d.r), fz = -Math.sin(d.r), sg = d.speed >= 0 ? 1 : -1, dist = d.speed * dt, steps = Math.min(40, Math.max(1, Math.ceil(Math.abs(dist) / 1.0)));
    let hit = null;
    for (let i = 0; i < steps; i++) {
      const nx = d.x + (fx * dist) / steps, nz = d.z + (fz * dist) / steps, ax = nx + fx * K.len * sg, az = nz + fz * K.len * sg;
      if (air) { if (hitSolid(ax, az, d.alt)) { hit = 'building'; break; } if (terr(ax, az) > d.alt + 2.5) { hit = 'mountain'; break; } }
      else if (collides(ax, az)) { hit = 'wall'; break; }
      d.x = nx; d.z = nz;
    }
    if (hit) { const sev = Math.abs(d.speed); d.speed *= -0.25; d.x -= fx * sg * 0.9; d.z -= fz * sg * 0.9; if (sev > (air ? 5 : 6)) damage(d, 1, 'crash'); }
    if (E) E.clampWorld(d); else { d.x = clamp(d.x, -LIM + 2, LIM - 2); d.z = clamp(d.z, -LIM + 2, LIM - 2); }
    const rf = roofAt(d.x, d.z, d.alt), th = terr(d.x, d.z);
    d.gh = Math.max(th, rf ? rf.h : 0);
    if (!air) d.alt = th;
    else if (d.alt < d.gh) { if (prevAlt > d.gh + 0.2 && (prevAlt - d.alt) / dt > (d.kind === 'plane' ? 15 : 11)) damage(d, 1, 'hard landing'); d.alt = d.gh; if (d.kind === 'heli') d.speed *= 1 - 2 * dt; }
    else if (air && E && d.alt < 1 && E.isWater(d.x, d.z)) d.speed *= 1 - 1.2 * dt;     // seaplane: it floats and drags on the sea
    if (!air) {                                                                       // traffic: crash into other cars
      for (const v of vehicles) { if (v === rec || v.wreck || v.wrecked) continue; const ox = v.obj.position.x - d.x, oz = v.obj.position.z - d.z; if (ox * ox + oz * oz < 7) { if (Math.abs(d.speed) > 2.5) crashInto(v, d); else { d.x -= ox * 0.1; d.z -= oz * 0.1; } break; } }
    }
    const o = d.obj; o.position.set(d.x, d.alt, d.z); o.rotation.y = d.r;
    d.roll += (-s * 0.35 * Math.min(1, Math.abs(d.speed) / 10) - d.roll) * Math.min(1, dt * 5); o.rotation.x = d.kind === 'car' ? 0 : d.roll;
    if (d.kind === 'plane') o.rotation.z = d.alt > d.gh + 0.1 ? clamp((up - dn) * 0.2 - (dead ? 0.35 : 0), -0.4, 0.3) : 0;
    if (d.kind === 'heli') o.rotation.z = -d.speed * 0.008;
    if (o.userData.wheels) o.userData.wheels.forEach((w) => { w.rotation.z -= (d.speed * dt) / 0.4; });
    pos().set(d.x, d.alt, d.z);
    if (d.kind === 'bike') player.group.rotation.set(0, d.r + Math.PI / 2, 0);
    setCam(lerpA(getYaw(), Math.atan2(-fx, -fz), 1 - Math.exp(-3 * dt)), K.dist + (air ? Math.min(60, d.alt * 0.03) : 0));
    if (rec.max && (rec.burning || rec.hp < rec.max)) hazards.add(rec);
  }
  function hazardTick(dt) {
    shake = Math.max(0, shake - dt * 1.6);
    hazards.forEach((r) => {
      if (r.wrecked) { if (tt > (r.respawn || 0) && (!r.obj.position || Math.hypot(r.obj.position.x - pos().x, r.obj.position.z - pos().z) > 25)) restore(r); return; }
      const o = r.obj.position, driven = drv && drv.rec === r;
      if (r.wreck) {                                                                // a knocked car slides, spins and may hit the next one
        const w = r.wreck; w.t += dt; o.x += w.vx * dt; o.z += w.vz * dt; w.vx *= 1 - 1.8 * dt; w.vz *= 1 - 1.8 * dt; r.obj.rotation.y += w.spin * dt * Math.min(1, Math.hypot(w.vx, w.vz) / 4); w.spin *= 1 - 1.2 * dt;
        r.obj.rotation.z = Math.min(0.25, Math.hypot(w.vx, w.vz) * 0.03);
        if (Math.hypot(w.vx, w.vz) > 3) for (const v of vehicles) { if (v === r || v.wreck || v.wrecked) continue; const ox = v.obj.position.x - o.x, oz = v.obj.position.z - o.z; if (ox * ox + oz * oz < 7) { const L = Math.hypot(ox, oz) || 1, sp = Math.hypot(w.vx, w.vz) * 0.7; v.held = true; v.wreck = { vx: (ox / L) * sp, vz: (oz / L) * sp, spin: (rnd() - 0.5) * 6, t: 0 }; if (v.hp === undefined) { v.hp = HP.car; v.max = HP.car; } v.hp--; hazards.add(v); w.vx *= -0.3; w.vz *= -0.3; say('Pile-up! The crash hit another car.'); break; } }
      }
      r.emit = (r.emit || 0) - dt;
      if (r.emit <= 0 && (r.burning || r.hp < r.max)) {
        r.emit = r.burning ? 0.05 : 0.16; const air = r.obj.userData.kind === 'plane' || r.obj.userData.kind === 'heli', y = o.y + (air ? 1.6 : 1.1);
        if (r.burning) { puff(o.x, y, o.z, true, 0.9); if (rnd() < 0.5) puff(o.x, y + 1, o.z, false, 1.2); } else puff(o.x, y, o.z, false, 0.8);
      }
      if (r.burning) {
        r.burnT = (r.burnT || 0) + dt; const k = r.obj.userData.kind, grounded = !driven || (drv.alt <= drv.gh + 0.3);
        if (!driven && r.burnT > 9) wreck(r, r.label); else if (driven && grounded && r.burnT > (k === 'car' ? 6 : 5)) wreck(r, drv.label);
        else if (driven && k === 'car' && r.burnT > 6) wreck(r, drv.label);
      }
      if (r.wreck && r.wreck.t > 16 && Math.hypot(o.x - pos().x, o.z - pos().z) > 40 && !r.burning) { r.wreck = null; r.held = false; r.obj.rotation.z = 0; hazards.delete(r); if (r.hp < r.max) r.hp = r.max; }
    });
    for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i]; if (!q.sp.visible) continue; q.t += dt; const k = q.t / q.life; if (k >= 1) { q.sp.visible = false; continue; } q.sp.position.y += q.vy * dt; q.sp.scale.setScalar(1.5 + q.grow * k); q.sp.material.opacity = 1 - k; }
  }
  function update(dt, t, dirs) {
    tt += dt; sky.position.copy(camera.position); if (window.__twPanorama) sky.visible = false;
    clouds.forEach((g) => { g.position.x += dt * 2; if (g.position.x > 500) g.position.x = -500; });
    const cyc = tt % CYC; let acc = 0, name = 'qiyam'; for (const [n, len] of SEQ) { acc += len; if (cyc < acc) { name = n; break; } }
    const wrapped = cyc < prevCyc; prevCyc = cyc; const k = Math.min(1, dt * 5);
    crowd.forEach((w) => { poseTo(w.pose, name, k); applyPose(w.p, w.x, w.z, WEST, w.pose); });
    if (praying) { poseTo(praying.ps, name, k); if (wrapped && tt - praying.since > 8) queue.push('rakat'); if (dirs.has('f') || dirs.has('b') || dirs.has('l') || dirs.has('r')) stopPray(); }
    for (let i = drivers.length - 1; i >= 0; i--) {
      const q = drivers[i]; q.t += dt; const g = q.p.group; g.position.x += q.dx * 3.2 * dt; g.position.z += q.dz * 3.2 * dt; g.rotation.y = Math.atan2(q.dx, q.dz);
      const sw = Math.sin(q.t * 12); q.p.legL.rotation.x = sw * 0.8; q.p.legR.rotation.x = -sw * 0.8; q.p.armL.rotation.x = q.p.armR.rotation.x = -2.6 + sw * 0.4;
      if (q.t > 6) { scene.remove(g); drivers.splice(i, 1); }
    }
    rides.forEach((r) => { const u = r.obj.userData, on = drv && drv.obj === r.obj; if (u.rotor) u.rotor.rotation.y += dt * (on ? 30 : 0); if (u.tail) u.tail.rotation.z += dt * (on ? 40 : 0); if (u.prop) u.prop.rotation.x += dt * (on ? 40 : 0); });
    missionTick(dt); hazardTick(dt);
    rides.forEach((r) => { if (r.wrecked && tt > r.respawn && Math.hypot(r.x - pos().x, r.z - pos().z) > 25) restore(r); });
    if (drv) { drive(dt, dirs); showHp(); return true; }
    return !!praying;
  }
  function post(t) {                                   // after the walking animation: ride and prayer poses for the player
    if (praying) applyPose(player, slotX, slotZ, WEST, praying.ps);
    else if (drv && drv.kind === 'bike') { const s = Math.sin(tt * Math.abs(drv.speed) * 0.8) * 0.7 * Math.min(1, Math.abs(drv.speed)); player.legL.rotation.x = s - 0.4; player.legR.rotation.x = -s - 0.4; player.armL.rotation.x = player.armR.rotation.x = -1.2; player.group.position.y = 0.42; }
  }
  function target(p) {
    if (praying) return { type: 'x-unpray', text: 'Press E to finish praying' };
    if (drv) return { type: 'x-exit', text: drv.alt > drv.gh + 1.5 ? 'Land first, then press E to get out' : 'Press E to get out' };
    if (standingOn) { const s = standingOn; if (Math.min(p.x - s.minX, s.maxX - p.x, p.z - s.minZ, s.maxZ - p.z) < 1.6) return { type: 'x-down', text: 'Press E to climb down to the street' }; }
    let best = null, bd = 6;
    rides.forEach((r) => { if (r.wrecked) return; const d = Math.hypot(r.obj.position.x - p.x, r.obj.position.z - p.z); if (d < Math.min(bd, 4) && Math.abs(r.obj.position.y - p.y) < 3) { bd = d; best = { type: 'x-ride', r, text: `Press E to get on the ${r.label}` }; } });
    if (!standingOn) vehicles.forEach((v) => { if (v.wrecked) return; const d = Math.hypot(v.obj.position.x - p.x, v.obj.position.z - p.z); if (d < bd) { bd = d; best = v.held ? { type: 'x-take', v, text: `Press E to sit in the ${CARNAME}` } : { type: 'x-stop', v, text: `Press E to stop the ${CARNAME} and pull the driver out` }; } });
    if (!best && Math.hypot(slotX - p.x, slotZ - p.z) < 3.2) best = { type: 'x-pray', text: 'Press E to join the prayer' };
    return best;
  }
  function act(tg) {
    if (tg.type === 'x-stop') pullDriver(tg.v);
    else if (tg.type === 'x-take') startDrive('car', tg.v.obj, tg.v, CARNAME);
    else if (tg.type === 'x-ride') startDrive(tg.r.kind, tg.r.obj, tg.r, tg.r.label);
    else if (tg.type === 'x-down') climbDown();
    else if (tg.type === 'x-exit') stopDrive();
    else if (tg.type === 'x-pray') startPray();
    else if (tg.type === 'x-unpray') stopPray();
  }
  function drawMap(mm, mx, w) {
    const px = (v) => clamp(mx(v), 7, w - 7), mark = (x, z, col, r) => { mm.fillStyle = col; mm.beginPath(); mm.arc(px(x), px(z), r, 0, 6.29); mm.fill(); };
    mark(MX, MZ, '#22c55e', 4); mark(AX, 0, '#94a3b8', 4); mark(PADX, PADZ, '#e2e8f0', 3);
    rides.forEach((r) => mark(r.obj.position.x, r.obj.position.z, '#f97316', 2));
    const tg = cur && (cur.target || (cur.type === 'pray' ? { x: slotX, z: slotZ } : null)); if (tg) { mm.strokeStyle = '#facc15'; mm.lineWidth = 2; mm.beginPath(); mm.arc(px(tg.x), px(tg.z), 6, 0, 6.29); mm.stroke(); const me = pos(); mm.setLineDash([4, 4]); mm.beginPath(); mm.moveTo(px(me.x), px(me.z)); mm.lineTo(px(tg.x), px(tg.z)); mm.stroke(); mm.setLineDash([]); }
  }
  const EVENTS = ['talk', 'shop', 'buy', 'wave', 'dance', 'photo'];
  startMission();
  // Save System: the world page reads the mission number and restores it from a save
  const mission = () => idx;
  const setMission = (i) => { idx = clamp(Math.round(i) || 0, 0, Missions.TOTAL - 1); try { localStorage.setItem(KEY, String(idx)); } catch (e) { /* ignore */ } startMission(); };
  const setEarth = (e) => { E = e; if (landMesh) landMesh.visible = false; };
  const standOn = (s) => { standingOn = s; const p = player.group.position; p.set((s.minX + s.maxX) / 2, s.h, (s.minZ + s.maxZ) / 2); player.group.visible = true; };
  return { standOn, get _drv() { return drv; }, setEarth, spawnRide, removeRide, get roof() { return standingOn; }, get shake() { return shake; }, mission, setMission, setPaint, update, post, target, act, drawMap, event: (n) => { if (EVENTS.includes(n)) queue.push(n); }, noFight: () => !!drv || !!praying || inMosque(pos()), get driving() { return !!drv; } };
}
