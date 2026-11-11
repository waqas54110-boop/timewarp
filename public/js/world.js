import * as THREE from '/vendor/three/three.module.js';
import { create as createExtras } from '/js/extras.js';
import { createWorldVideo } from '/js/world-video.js';
import { createSky } from '/js/world-sky.js';
import { createEarth } from '/js/world-earth.js';
import { mergeGeometries } from '/vendor/three-addons/utils/BufferGeometryUtils.js';

const root = document.getElementById('world');
const canvas = document.getElementById('world-canvas');
const statusEl = document.getElementById('world-status');
const mode = root.dataset.mode;
const seed0 = Number(root.dataset.year) * 31 + Number(root.dataset.seed);
const Crowd = window.TimeWarpCrowd, Face = window.TimeWarpFace, Social = window.TimeWarpSocial, Dialogue = window.TimeWarpDialogue;
const YEAR = Number(root.dataset.year), PLACE = root.dataset.place || 'the world';
const fy = (y) => (y < 0 ? `${-y} BCE` : y < 1000 ? `${y} CE` : String(y));
['.site-header', '.site-footer', '.skip'].forEach((s) => { const n = document.querySelector(s); if (n) n.inert = true; });

function fail(msg) { statusEl.hidden = false; statusEl.textContent = msg; throw new Error(msg); }
if (!Crowd || !Face || !Social || !Dialogue) fail('Could not load the world scripts. Reload the page.');
try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) throw 0; } catch { fail('Your browser cannot show 3D graphics. Use "Back to scene".'); }

const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rand = rng(seed0);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// ---------- era settings ----------
const THEMES = {
  past: {
    sky: 0xe8b26a, fog: 0xd7a465, fogD: 0.011, road: '#8a6a45', side: '#a88a63', block: '#97794f',
    walls: ['#c29a6b', '#b98550', '#d1ae7e', '#a97a4a'], win: ['#3b2a1a', '#4a3320'], winP: 0.22, glow: 0,
    hMin: 4, hMax: 8, amb: 0xffe6c0, ambI: 0.85, sun: 0xffc27a, sunI: 1.0, npc: 26, lamp: 0xffd79a,
    names: ['Halwai', 'Pansari', 'Sarai', 'Hakeem', 'Darzi', 'Chai Khana', 'Kulfa House', 'Sarraf'],
    signBg: ['#7a2e1d', '#2d4a2a', '#3a2a5a', '#8a5a12'], tree: 0x6f8a3c,
  },
  present: {
    sky: 0x86c5ff, fog: 0xa9d6ff, fogD: 0.008, road: '#3b3f46', side: '#9aa0a8', block: '#8a9099',
    walls: ['#b8bfcc', '#c9b8a6', '#9fb1c9', '#d6d2c8'], win: ['#4d76a8', '#5f86b8'], winP: 0.7, glow: 0,
    hMin: 8, hMax: 22, amb: 0xbfd8ff, ambI: 0.85, sun: 0xffffff, sunI: 1.1, npc: 42, lamp: 0xfff2c0,
    names: ['Cafe', 'Pharmacy', 'Mobile Shop', 'Bakery', 'Tailor', 'Grocery', 'Books', 'Barber'],
    signBg: ['#b91c1c', '#0f766e', '#1d4ed8', '#a16207'], tree: 0x3f8f3a,
  },
  future: {
    sky: 0x0a0620, fog: 0x1a0c44, fogD: 0.013, road: '#0d0a24', side: '#1c1745', block: '#150f38',
    walls: ['#1a1550', '#221a66', '#141046', '#2a1f78'], win: ['#67e8f9', '#c4b5fd', '#f0abfc'], winP: 0.5, glow: 0.9,
    hMin: 14, hMax: 46, amb: 0x5b49b8, ambI: 0.9, sun: 0x8f7bff, sunI: 0.45, npc: 36, lamp: 0x22d3ee,
    names: ['Hover Garage', 'Neon Noodles', 'Robo Repair', 'Data Cafe', 'Holo Mart', 'Sky Pharmacy'],
    signBg: ['#4c1d95', '#0e7490', '#9d174d', '#1e3a8a'], tree: 0,
  },
};
const TH = THEMES[mode] || fail('Unknown era.');
const N = 9, P = 22, EX = (N + 1) * P, HALF = (N * P) / 2 - 1, LIM = EX / 2 + 150;   // town grid + land around it (mosque east, airfield west)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color(TH.sky);
scene.fog = new THREE.FogExp2(TH.fog, TH.fogD);
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 420);
const ambLight = new THREE.AmbientLight(TH.amb, TH.ambI); scene.add(ambLight);
const sun = new THREE.DirectionalLight(TH.sun, TH.sunI); sun.position.set(-40, 60, 30); scene.add(sun);
// Optional real panorama: drop an equirectangular photo at public/media/sky-<past|present|future>.jpg
new THREE.TextureLoader().load(`/media/sky-${mode}.jpg`, (tex) => { tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex; window.__twPanorama = true; }, undefined, () => {});

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const cs = Crowd.blockCenters(N, P), roads = Crowd.roadCenters(N, P);

// ---------- ground: roads, sidewalks, lane lines painted on one texture ----------
(function ground() {
  const S = 2048, k = S / EX, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), X = (v) => (v + EX / 2) * k;
  g.fillStyle = TH.road; g.fillRect(0, 0, S, S);
  if (mode === 'past') for (let i = 0; i < 5000; i++) { g.fillStyle = rand() < 0.5 ? '#00000012' : '#ffffff10'; g.fillRect(rand() * S, rand() * S, 3 + rand() * 8, 2 + rand() * 4); }
  cs.forEach((cx) => cs.forEach((cz) => {
    g.fillStyle = TH.side; g.fillRect(X(cx - 8.5), X(cz - 8.5), 17 * k, 17 * k);
    g.fillStyle = TH.block; g.fillRect(X(cx - 7), X(cz - 7), 14 * k, 14 * k);
  }));
  if (mode !== 'past') {
    g.lineWidth = 0.18 * k;
    if (mode === 'present') { g.strokeStyle = '#e6e6e6'; g.setLineDash([2.2 * k, 2.2 * k]); }
    else { g.strokeStyle = '#22d3ee'; g.shadowColor = '#22d3ee'; g.shadowBlur = 8; }
    roads.forEach((r) => {
      g.beginPath(); g.moveTo(0, X(r)); g.lineTo(S, X(r)); g.stroke();
      g.beginPath(); g.moveTo(X(r), 0); g.lineTo(X(r), S); g.stroke();
    });
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(EX, EX), lam(0xffffff, { map: tex }));
  m.rotation.x = -Math.PI / 2; scene.add(m);
})();

// ---------- buildings with working shops ----------
const solids = [];
const boxGeo = new THREE.BoxGeometry(1, 1, 1), planeGeo = new THREE.PlaneGeometry(1, 1);
const wallCache = new Map(), signCache = new Map();

function windowTexture(color, repY) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) for (let x = 6; x < 58; x += 16) if (rand() < TH.winP) { g.fillStyle = pick(TH.win); g.fillRect(x, y, 9, 11); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, repY); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function wallMats(h, ci) {
  const repY = Math.max(1, Math.round(h / 4.5)), key = `${ci}-${repY}`;
  if (!wallCache.has(key)) {
    const tex = windowTexture(TH.walls[ci], repY);
    const side = lam(0xffffff, { map: tex, emissive: TH.glow ? 0xffffff : 0x000000, emissiveMap: TH.glow ? tex : null, emissiveIntensity: TH.glow });
    const roof = lam(new THREE.Color(TH.walls[ci]).multiplyScalar(0.7));
    wallCache.set(key, [side, side, roof, roof, side, side]);
  }
  return wallCache.get(key);
}
function signMaterial(name, bg) {
  const key = name + bg;
  if (!signCache.has(key)) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = mode === 'future' ? '#67e8f9' : '#ffffffaa'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
    g.font = 'bold 54px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (mode === 'future') { g.shadowColor = '#22d3ee'; g.shadowBlur = 18; }
    g.fillStyle = '#fff'; g.fillText(name, 256, 66, 480);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    signCache.set(key, basic(0xffffff, { map: t }));
  }
  return signCache.get(key);
}
const openMat = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const g = c.getContext('2d'); g.fillStyle = '#052e16'; g.fillRect(0, 0, 128, 48); g.fillStyle = '#4ade80'; g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OPEN', 64, 26);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return basic(0xffffff, { map: t });
})();
const glassMat = basic(mode === 'future' ? 0x8fe9ff : 0xffe2a8);

// ---------- static pieces are merged: one mesh per material instead of thousands of tiny meshes (this is what made the game stutter) ----------
const batch = new Map();                                   // material -> [geometry, ...]
const _M = new THREE.Matrix4(), _G = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _P = new THREE.Vector3(), _S = new THREE.Vector3();
function stat(geo, material, group, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) {     // group = [gx, gz, yaw] (the shopfront's own position)
  _M.compose(_P.set(x, y, z), _Q.setFromEuler(_E.set(rx, 0, 0)), _S.set(sx, sy, sz));
  if (group) _M.premultiply(_G.compose(_P.set(group[0], 0, group[1]), _Q.setFromEuler(_E.set(0, group[2], 0)), _S.set(1, 1, 1)));
  const g = geo.clone(); g.applyMatrix4(_M);
  if (!batch.has(material)) batch.set(material, []);
  batch.get(material).push(g);
}
function flushStatic() {
  batch.forEach((list, material) => {
    const g = mergeGeometries(list, false); list.forEach((q) => q.dispose());
    const m = new THREE.Mesh(g, material); m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m);
  });
  batch.clear();
}
const awnCache = new Map(), awnMat = (bg) => { if (!awnCache.has(bg)) awnCache.set(bg, lam(bg)); return awnCache.get(bg); };

// A shopfront on one face of a building: lit window, awning, name board, OPEN sign.
const shopSpots = [];
function shopFront(b, side) {
  const name = pick(TH.names), bg = pick(TH.signBg);
  const along = side === 'pz' || side === 'nz' ? b.w : b.d, depth = side === 'pz' || side === 'nz' ? b.d : b.w;
  const sw = Math.min(along * 0.85, 4.6);
  const pos = { pz: [b.x, 0, b.z + depth / 2, 0], nz: [b.x, 0, b.z - depth / 2, Math.PI], px: [b.x + depth / 2, 0, b.z, Math.PI / 2], nx: [b.x - depth / 2, 0, b.z, -Math.PI / 2] }[side];
  const grp = [pos[0], pos[2], pos[3]];
  stat(planeGeo, glassMat, grp, 0, 1.25, 0.02, sw * 0.8, 2.2, 1);
  stat(planeGeo, signMaterial(name, bg), grp, 0, 3.2, 0.03, sw, sw / 4, 1);
  stat(boxGeo, awnMat(bg), grp, 0, 2.65, 0.5, sw, 0.1, 1.0, 0.25);
  stat(planeGeo, openMat, grp, sw * 0.28, 1.6, 0.04, 0.7, 0.26, 1);
  const out = { pz: [0, 1], nz: [0, -1], px: [1, 0], nx: [-1, 0] }[side]; // where a shopkeeper can stand: just outside the wall
  shopSpots.push({ x: pos[0] + out[0] * 0.55, z: pos[2] + out[1] * 0.55, yaw: Math.atan2(out[0], out[1]), name });
}
const buildings = [], shellBatch = new Map();               // shellBatch: key -> { side: [geo], roof: [geo], mats }
function addBuilding(x, z, w, d, h, ci) {
  const mats = wallMats(h, ci), key = mats[0].uuid + mats[2].uuid;
  if (!shellBatch.has(key)) shellBatch.set(key, { side: [], roof: [], mats });
  const g = boxGeo.clone(); g.applyMatrix4(_M.compose(_P.set(x, h / 2, z), _Q.identity(), _S.set(w, h, d)));
  const idx = g.index.array, pick6 = (from, to) => Array.from(idx.slice(from * 6, to * 6));   // box faces: 0 px, 1 nx, 2 py, 3 ny, 4 pz, 5 nz
  const part = (arr) => { const q = g.clone(); q.setIndex(arr); return q; };
  const E = shellBatch.get(key);
  E.side.push(part([...pick6(0, 2), ...pick6(4, 6)])); E.roof.push(part(pick6(2, 3)));
  g.dispose();
  const so = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h, roof: true }; solids.push(so);
  const rec = { x, z, w, d, h, solid: so }; buildings.push(rec); return rec;
}
function flushShells() {
  shellBatch.forEach((E) => {
    [['side', E.mats[0]], ['roof', E.mats[2]]].forEach(([k, material]) => {
      const g = mergeGeometries(E[k], false); E[k].forEach((q) => q.dispose());
      const m = new THREE.Mesh(g, material); m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m);
    });
  });
  shellBatch.clear();
}
const doors = [], doorMat = lam(0x3a2a1a);
function addDoor(b, side) {          // the free face of a building gets a lobby door with a lift
  const pos = { pz: [b.x, b.z + b.d / 2, 0, 0, 1], nz: [b.x, b.z - b.d / 2, Math.PI, 0, -1] }[side], grp = [pos[0], pos[1], pos[2]];
  stat(boxGeo, doorMat, grp, 0, 1.15, 0.05, 1.5, 2.3, 0.1); stat(planeGeo, signMaterial('LIFT', '#374151'), grp, 0, 2.7, 0.07, 1.5, 0.38, 1);
  doors.push({ b, x: pos[0], z: pos[1] + pos[4] * 1.0 });
}
cs.forEach((cx) => cs.forEach((cz) => {
  const A = addBuilding(cx - 3.1, cz, 5.8, 12, TH.hMin + rand() * (TH.hMax - TH.hMin), (rand() * TH.walls.length) | 0);
  const B = addBuilding(cx + 3.1, cz, 5.8, 12, TH.hMin + rand() * (TH.hMax - TH.hMin), (rand() * TH.walls.length) | 0);
  shopFront(A, 'pz'); shopFront(A, 'nx'); shopFront(B, 'nz'); shopFront(B, 'px'); addDoor(A, 'nz'); addDoor(B, 'pz');
}));
flushShells(); flushStatic();

// ---------- street lamps and trees (instanced) ----------
const dummy = new THREE.Object3D();
function instanced(geo, mat, list) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((p, i) => { dummy.position.set(p[0], p[1], p[2]); dummy.scale.set(p[3] || 1, p[4] || p[3] || 1, p[3] || 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
  im.instanceMatrix.needsUpdate = true; scene.add(im); return im;
}
{
  const poles = [], heads = [], trunks = [], crowns = [];
  cs.forEach((cx) => cs.forEach((cz) => {
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => { poles.push([cx + sx * 8.3, 2.5, cz + sz * 8.3]); heads.push([cx + sx * 8.3, 5.1, cz + sz * 8.3]); }));
    if (TH.tree) for (let i = 0; i < 3; i++) {
      const s = (rand() * 4) | 0, t = (rand() - 0.5) * 9, e = 8.1;
      const [tx, tz] = [[cx + t, cz + e], [cx + t, cz - e], [cx + e, cz + t], [cx - e, cz + t]][s];
      trunks.push([tx, 1, tz]); crowns.push([tx, 2.9, tz, 1.1 + rand() * 0.5]);
    }
  }));
  instanced(new THREE.CylinderGeometry(0.06, 0.08, 5, 6), lam(mode === 'future' ? 0x39308a : 0x444a55), poles);
  instanced(new THREE.SphereGeometry(0.24, 8, 6), basic(TH.lamp), heads);
  if (TH.tree) { instanced(new THREE.CylinderGeometry(0.12, 0.17, 2, 6), lam(0x5b3f26), trunks); instanced(new THREE.SphereGeometry(1, 9, 7), lam(TH.tree), crowns); }
}

// ---------- people ----------
const matCache = new Map();
const mat = (hex) => { if (!matCache.has(hex)) matCache.set(hex, lam(hex)); return matCache.get(hex); };
const SKINS = [0xf1c9a5, 0xd9a37e, 0xb97a56, 0x8d5a3c, 0x6b4128];
const PANTS = mode === 'past' ? [0xe9e2cf, 0xd9cfae, 0x8a7a5a] : [0x1f2937, 0x374151, 0x1e3a5f, 0x4b3b2a];
const SHIRTS = mode === 'past' ? [0xf5efe0, 0xd8c9a2, 0x9bb59a, 0xc58b5a, 0x7a5c8a] : mode === 'future' ? [0x7c3aed, 0x0ea5e9, 0xec4899, 0x22c55e, 0xf5f5f5] : [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0xe5e7eb];
const HAIRS = [0x15110d, 0x2a1c14, 0x4a3320, 0x8a8a8a, 0x15110d];

function makePerson(o) {
  const g = new THREE.Group();
  const shirt = o.shirtMat || mat(o.shirt), skin = o.skinMat || mat(o.skin);
  const torso = new THREE.Mesh(boxGeo, shirt); torso.scale.set(0.46, 0.6, 0.26); torso.position.y = 1.15; g.add(torso);
  if (o.long) { const tun = new THREE.Mesh(boxGeo, shirt); tun.scale.set(0.5, 0.5, 0.3); tun.position.y = 0.72; g.add(tun); }
  if (o.neon) { const st = new THREE.Mesh(boxGeo, basic(0x22d3ee)); st.scale.set(0.48, 0.05, 0.28); st.position.y = 1.2; g.add(st); }
  const limb = (x, y, w, h, m, handY) => {
    const piv = new THREE.Group(); piv.position.set(x, y, 0);
    const mesh = new THREE.Mesh(boxGeo, m); mesh.scale.set(w, h, w + 0.01); mesh.position.y = -h / 2; piv.add(mesh);
    if (handY !== undefined) { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skin); hand.position.y = handY; piv.add(hand); }
    else { const shoe = new THREE.Mesh(boxGeo, mat(0x15110d)); shoe.scale.set(0.2, 0.08, 0.3); shoe.position.set(0, -h + 0.04, 0.04); piv.add(shoe); }
    g.add(piv); return piv;
  };
  const pants = o.pantsMat || mat(o.pants);
  const legL = limb(-0.11, 0.86, 0.17, 0.86, pants), legR = limb(0.11, 0.86, 0.17, 0.86, pants);
  const armL = limb(-0.3, 1.43, 0.11, 0.55, shirt, -0.58), armR = limb(0.3, 1.43, 0.11, 0.55, shirt, -0.58);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), skin); neck.position.y = 1.5; g.add(neck);
  const headMat = o.headMat || skin;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), headMat); head.position.y = 1.65; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.157, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.2), o.hairMat || mat(o.hair)); hair.position.y = 1.65; g.add(hair);
  if (o.cap) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.08, 14), mat(o.cap)); cap.position.y = 1.8; g.add(cap);
    const brim = new THREE.Mesh(boxGeo, mat(0x0b1220)); brim.scale.set(0.24, 0.02, 0.12); brim.position.set(0, 1.77, 0.15); g.add(brim);
    const badge = new THREE.Mesh(boxGeo, basic(0xfacc15)); badge.scale.set(0.07, 0.07, 0.01); badge.position.set(0.12, 1.3, 0.14); g.add(badge);
  }
  const flames = [];
  if (o.jetpack) {
    [-0.12, 0.12].forEach((x) => {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), basic(0x22d3ee)); tank.position.set(x, 1.2, -0.2); g.add(tank);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 8), basic(0xf0abfc)); fl.rotation.x = Math.PI; fl.position.set(x, 0.8, -0.2); g.add(fl); flames.push(fl);
    });
  }
  return { group: g, legL, legR, armL, armR, flames };
}
// Crowd people: the same figure as makePerson, but each body part is ONE merged mesh with vertex colours (5 draw calls instead of ~17).
const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const _col = new THREE.Color(), _bm = new THREE.Matrix4();
const headGeo = new THREE.SphereGeometry(0.15, 12, 8), hairGeo = new THREE.SphereGeometry(0.157, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.2), neckGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.12, 6);
const handGeo = new THREE.SphereGeometry(0.06, 6, 4), capGeo = new THREE.CylinderGeometry(0.16, 0.17, 0.08, 10);
function part(geo, hex, x, y, z, sx = 1, sy = 1, sz = 1) {
  const g = geo.clone(); g.applyMatrix4(_bm.compose(_P.set(x, y, z), _Q.identity(), _S.set(sx, sy, sz)));
  const n = g.attributes.position.count, c = new Float32Array(n * 3); _col.set(hex);
  for (let i = 0; i < n; i++) { c[i * 3] = _col.r; c[i * 3 + 1] = _col.g; c[i * 3 + 2] = _col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function makeCrowdPerson(o) {
  if (o.jetpack) return makePerson(o);
  const g = new THREE.Group(), body = [];
  body.push(part(boxGeo, o.shirt, 0, 1.15, 0, 0.46, 0.6, 0.26));
  if (o.long) body.push(part(boxGeo, o.shirt, 0, 0.72, 0, 0.5, 0.5, 0.3));
  if (o.neon) body.push(part(boxGeo, 0x22c55e, 0, 1.2, 0, 0.48, 0.05, 0.28));
  body.push(part(neckGeo, o.skin, 0, 1.5, 0), part(headGeo, o.skin, 0, 1.65, 0), part(hairGeo, o.hair, 0, 1.65, 0));
  if (o.cap) body.push(part(capGeo, o.cap, 0, 1.8, 0), part(boxGeo, 0x0b1220, 0, 1.77, 0.15, 0.24, 0.02, 0.12), part(boxGeo, 0xfacc15, 0.12, 1.3, 0.14, 0.07, 0.07, 0.01));
  const bm = new THREE.Mesh(mergeGeometries(body, false), vcMat); body.forEach((q) => q.dispose()); g.add(bm);
  const limb = (x, y, w, h, hex, handY) => {
    const piv = new THREE.Group(); piv.position.set(x, y, 0);
    const parts = [part(boxGeo, hex, 0, -h / 2, 0, w, h, w + 0.01)];
    parts.push(handY !== undefined ? part(handGeo, o.skin, 0, handY, 0) : part(boxGeo, 0x15110d, 0, -h + 0.04, 0.04, 0.2, 0.08, 0.3));
    piv.add(new THREE.Mesh(mergeGeometries(parts, false), vcMat)); parts.forEach((q) => q.dispose()); g.add(piv); return piv;
  };
  const legL = limb(-0.11, 0.86, 0.17, 0.86, o.pants), legR = limb(0.11, 0.86, 0.17, 0.86, o.pants);
  const armL = limb(-0.3, 1.43, 0.11, 0.55, o.shirt, -0.58), armR = limb(0.3, 1.43, 0.11, 0.55, o.shirt, -0.58);
  return { group: g, legL, legR, armL, armR, flames: [] };
}
function swing(p, phase, amt) {
  const s = Math.sin(phase) * amt;
  p.legL.rotation.x = s; p.legR.rotation.x = -s; p.armL.rotation.x = -s * 0.8; p.armR.rotation.x = s * 0.8;
}

// the visitor's avatar: own head texture + adjustable materials
const skinMat = lam(0xd9a37e), headMat = lam(0xffffff), shirtMat = lam(0x2563eb), hairMat = lam(0x2a1c14);
function setHeadCanvas(canvasEl) {
  if (headMat.map) headMat.map.dispose();
  const t = new THREE.CanvasTexture(canvasEl); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  headMat.map = t; headMat.needsUpdate = true;
  const pv = document.getElementById('face-preview').getContext('2d'); pv.clearRect(0, 0, 128, 64); pv.drawImage(canvasEl, 0, 0, 128, 64);
}
setHeadCanvas(Face.buildDefaultHead('#d9a37e'));
const player = makePerson({ skinMat, headMat, shirtMat, hairMat, pants: PANTS[0], pantsMat: mat(PANTS[0]), long: mode === 'past', neon: mode === 'future' });
scene.add(player.group);
player.group.position.set(Crowd.SIDEWALK, 0, Crowd.SIDEWALK);

// everyone else is driven by the street-life simulation (social.js): this file only draws it
const keeperShops = shopSpots.slice().sort(() => rand() - 0.5).slice(0, 14);
const sim = Social.createSim({ rand, N, P, citizens: TH.npc, police: mode === 'past' ? 2 : 4, flyers: mode === 'future' ? 12 : 0, shops: keeperShops, chatLines: Dialogue.chatLines(mode) });
const bubbleCache = new Map();
function bubbleMat(text) {
  if (!bubbleCache.has(text)) {
    const short = text.length <= 6, font = short ? 'bold 38px Arial, sans-serif' : 'bold 24px Arial, sans-serif';
    const meas = document.createElement('canvas').getContext('2d'); meas.font = font;
    const lines = []; let cur = '';
    text.split(' ').forEach((w) => { const tryL = cur ? cur + ' ' + w : w; if (meas.measureText(tryL).width > 260 && cur) { lines.push(cur); cur = w; } else cur = tryL; });
    lines.push(cur);
    const lh = short ? 44 : 30, W = Math.ceil(Math.max(110, Math.min(300, Math.max(...lines.map((l) => meas.measureText(l).width)) + 40))), H = lines.length * lh + 36;
    const c = document.createElement('canvas'); c.width = W; c.height = H + 16;
    const g = c.getContext('2d'), col = { '!': '#dc2626', 'STOP!': '#1d4ed8', Rs: '#15803d' }[text] || '#334155';
    g.fillStyle = '#fff'; g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 14); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(W / 2 - 10, H - 6); g.lineTo(W / 2, H + 10); g.lineTo(W / 2 + 10, H - 6); g.fill();
    g.fillStyle = col; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((l, i) => g.fillText(l, W / 2, 18 + lh / 2 + i * lh));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }); m.userData.size = [c.width * 0.0046, c.height * 0.0046];
    bubbleCache.set(text, m);
  }
  return bubbleCache.get(text);
}
function setBubble(sprite, text) {
  if (!text) { sprite.visible = false; return; }
  const m = bubbleMat(text), sz = m.userData.size;
  sprite.material = m; sprite.scale.set(sz[0], sz[1], 1); sprite.position.y = 1.9 + sz[1] / 2; sprite.visible = true;
}
const bodies = new Map();
sim.agents.forEach((a) => {
  a.name = Dialogue.nameFor(mode, a.id);
  const look = { skin: pick(SKINS), hair: pick(HAIRS) };
  const p = a.role === 'police' ? makeCrowdPerson({ ...look, shirt: 0x1e3a8a, pants: 0x111827, cap: 0x1e3a8a, neon: mode === 'future' })
    : a.role === 'keeper' ? makeCrowdPerson({ ...look, shirt: pick([0xf5f5f5, 0xfacc15, 0xfb923c, 0x34d399]), pants: pick(PANTS) })
    : makeCrowdPerson({ ...look, shirt: pick(SHIRTS), pants: pick(PANTS), long: mode === 'past' && rand() < 0.6, neon: mode === 'future' && rand() < 0.6, jetpack: a.flyer });
  const sprite = new THREE.Sprite(bubbleMat('!')); sprite.visible = false; p.group.add(sprite);
  scene.add(p.group); bodies.set(a.id, { p, sprite, text: '' });
});
function drawAgent(a, t) {
  const b = bodies.get(a.id), p = b.p, g = p.group;
  g.position.set(a.x, a.flyer ? a.alt + Math.sin(t * 1.5 + a.id) * 0.3 : 0, a.z); g.rotation.y = a.yaw;
  const ph = t * a.speed * 5 + a.id;
  switch (a.anim) {
    case 'walk': swing(p, ph, 0.6); break;
    case 'run': swing(p, t * 13 + a.id, 0.95); break;
    case 'talk': swing(p, 0, 0); p.armR.rotation.x = -0.9 + Math.sin(t * 6 + a.id) * 0.45; p.armL.rotation.x = -0.2 + Math.sin(t * 4 + a.id) * 0.15; break;
    case 'fight': { // shoving and flailing (cartoon scuffle, nobody gets hurt)
      const lunge = Math.sin(t * 9 + a.id) * 0.2; g.position.x += Math.sin(a.yaw) * lunge; g.position.z += Math.cos(a.yaw) * lunge;
      p.armL.rotation.x = -1.4 + Math.sin(t * 13 + a.id) * 0.8; p.armR.rotation.x = -1.4 + Math.sin(t * 13 + a.id + 2) * 0.8; p.legL.rotation.x = p.legR.rotation.x = 0; break;
    }
    case 'handsup': p.armL.rotation.x = p.armR.rotation.x = -2.9; p.legL.rotation.x = p.legR.rotation.x = 0; break;
    case 'trade': swing(p, 0, 0); p.armR.rotation.x = -1.2 + Math.sin(t * 3 + a.id) * 0.15; break;
    case 'wave': swing(p, 0, 0); p.armR.rotation.x = -2.6 + Math.sin(t * 8) * 0.4; break;
    case 'fly': p.legL.rotation.x = p.legR.rotation.x = 0.25; p.armL.rotation.x = p.armR.rotation.x = -0.3; p.flames.forEach((f, i) => f.scale.set(1, 0.7 + 0.5 * Math.abs(Math.sin(t * 20 + i)), 1)); break;
    default: swing(p, 0, 0);
  }
  if (a.bubble !== b.text) { b.text = a.bubble; setBubble(b.sprite, a.bubble); if (a.bubble) hear(a, a.bubble); }
}
const tickerEl = document.getElementById('world-ticker');
let lastLog = null;

// ---------- traffic ----------
const vehicles = [];
const carGeo = new THREE.BoxGeometry(3.8, 0.7, 1.7), cabGeo = new THREE.BoxGeometry(2.0, 0.6, 1.5), wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.25, 12);
const wheelMat = lam(0x15110d), glassDark = lam(0x1b2a3a);
function wheelAt(g, x, y, z, r = 1) { const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.x = Math.PI / 2; w.position.set(x, y, z); w.scale.set(r, 1, r); g.add(w); }
function bake(g, keep) {   // merge the static children of a vehicle (after the first `keep`) into vertex-coloured meshes
  const kids = g.children.slice(keep), lit = [], flat = [];
  kids.forEach((k) => {
    const m = k.material; if (!m || m.emissive && m.emissive.getHex() || m.transparent) return;
    k.updateMatrix(); const q = k.geometry.clone(); q.applyMatrix4(k.matrix);
    const n = q.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = m.color.r; c[i * 3 + 1] = m.color.g; c[i * 3 + 2] = m.color.b; }
    q.setAttribute('color', new THREE.BufferAttribute(c, 3)); q.deleteAttribute('uv');
    (m.isMeshBasicMaterial ? flat : lit).push(q); g.remove(k);
  });
  if (lit.length) g.add(new THREE.Mesh(mergeGeometries(lit, false), vcMat));
  if (flat.length) g.add(new THREE.Mesh(mergeGeometries(flat, false), vcBasic));
}
const vcBasic = new THREE.MeshBasicMaterial({ vertexColors: true }), carBodyMats = new Map();
function makeVehicle() {
  const g = new THREE.Group();
  if (mode === 'present') {
    const bus = rand() < 0.12, color = pick([0xdc2626, 0x2563eb, 0xf5f5f5, 0x16a34a, 0xfacc15, 0x111827]);
    if (bus) {
      const body = new THREE.Mesh(boxGeo, lam(0xf59e0b)); body.scale.set(8, 2.3, 2.2); body.position.y = 1.5; g.add(body);
      const win = new THREE.Mesh(boxGeo, glassDark); win.scale.set(7.4, 0.8, 2.25); win.position.y = 1.9; g.add(win);
      [-2.6, 2.6].forEach((x) => [-1, 1].forEach((z) => wheelAt(g, x, 0.4, z * 1.0, 1.2)));
      bake(g, 1);
    } else {
      if (!carBodyMats.has(color)) carBodyMats.set(color, lam(color));
      const body = new THREE.Mesh(carGeo, carBodyMats.get(color)); body.position.y = 0.55; g.add(body);
      const cab = new THREE.Mesh(cabGeo, glassDark); cab.position.set(-0.2, 1.15, 0); g.add(cab);
      const lights = new THREE.Mesh(boxGeo, basic(0xfff4c2)); lights.scale.set(0.05, 0.18, 1.3); lights.position.set(1.92, 0.65, 0); g.add(lights);
      [-1.2, 1.2].forEach((x) => [-0.85, 0.85].forEach((z) => wheelAt(g, x, 0.33, z)));
      bake(g, 1);
    }
  } else if (mode === 'past') { // horse-drawn tonga
    const wood = lam(0x6b4423), horse = lam(0x7a4a2a);
    const bed = new THREE.Mesh(boxGeo, wood); bed.scale.set(2.4, 0.25, 1.3); bed.position.set(-0.4, 0.95, 0); g.add(bed);
    const roof = new THREE.Mesh(boxGeo, lam(0xd9c9a0)); roof.scale.set(1.9, 0.08, 1.4); roof.position.set(-0.6, 2.3, 0); g.add(roof);
    [[-1.3, -0.6], [-1.3, 0.6], [0.1, -0.6], [0.1, 0.6]].forEach(([x, z]) => { const p = new THREE.Mesh(boxGeo, wood); p.scale.set(0.08, 1.3, 0.08); p.position.set(x, 1.6, z); g.add(p); });
    [-0.75, 0.75].forEach((z) => wheelAt(g, -0.4, 0.62, z, 1.9));
    const body = new THREE.Mesh(boxGeo, horse); body.scale.set(1.5, 0.75, 0.55); body.position.set(2.3, 1.35, 0); g.add(body);
    [[1.7, -0.18], [1.7, 0.18], [2.9, -0.18], [2.9, 0.18]].forEach(([x, z]) => { const l = new THREE.Mesh(boxGeo, horse); l.scale.set(0.14, 1.0, 0.14); l.position.set(x, 0.5, z); g.add(l); });
    const neck = new THREE.Mesh(boxGeo, horse); neck.scale.set(0.35, 0.8, 0.3); neck.position.set(3.1, 1.85, 0); neck.rotation.z = -0.4; g.add(neck);
    const head = new THREE.Mesh(boxGeo, horse); head.scale.set(0.6, 0.3, 0.3); head.position.set(3.45, 2.2, 0); g.add(head);
    const shaft = new THREE.Mesh(boxGeo, wood); shaft.scale.set(1.5, 0.06, 0.06); shaft.position.set(1.2, 1.0, 0.0); g.add(shaft);
    bake(g, 0);
  } else { // hover pod
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), lam(pick([0x7c3aed, 0x0ea5e9, 0xec4899]), { emissive: 0x3b1d7a, emissiveIntensity: 0.6 }));
    body.scale.set(2.2, 0.55, 1.0); body.position.y = 1.0; g.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0x9be7ff, { emissive: 0x1d6a8a, emissiveIntensity: 0.5 })); dome.position.set(0.2, 1.3, 0); g.add(dome);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), basic(0x22d3ee, { transparent: true, opacity: 0.55 })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.45; g.add(glow);
  }
  scene.add(g); return g;
}
const SPEED = { present: [7, 11], past: [2.2, 3.4], future: [8, 12] }[mode], PER_LANE = mode === 'past' ? 1 : 2;
['x', 'z'].forEach((axis) => roads.forEach((rc) => {
  if (rand() < 0.35) return;
  [1, -1].forEach((dir) => {
    const speed = SPEED[0] + rand() * (SPEED[1] - SPEED[0]);
    for (let k = 0; k < PER_LANE; k++) vehicles.push({ obj: makeVehicle(), axis, rc, dir, speed, s0: (k / PER_LANE) * EX + rand() * 15 - EX / 2 });
  });
}));
const policeCars = [];
if (mode !== 'past') vehicles.slice(0, 40).filter((_, i) => i % 9 === 0).slice(0, 2).forEach((v) => {
  const red = basic(0xff2222), blue = basic(0x2255ff), top = mode === 'future' ? 1.75 : 1.55;
  [[-0.35, red], [0.35, blue]].forEach(([z, m]) => { const l = new THREE.Mesh(boxGeo, m); l.scale.set(0.25, 0.14, 0.5); l.position.set(-0.2, top, z); v.obj.add(l); });
  policeCars.push({ red, blue });
});
function updateVehicles(t) {
  const flash = Math.floor(t * 5) % 2;
  policeCars.forEach((c) => { c.red.color.setHex(flash ? 0xff2222 : 0x330808); c.blue.color.setHex(flash ? 0x081433 : 0x2255ff); });
  vehicles.forEach((v) => {
    if (v.held) return;                                // a car you stopped stays where it is
    const s = Crowd.wrap(v.s0 + v.dir * v.speed * t, EX), bob = mode === 'future' ? 0.15 * Math.sin(t * 2 + v.s0) : 0;
    if (v.axis === 'x') { v.obj.position.set(s, bob, v.rc + v.dir * 1.25); v.obj.rotation.y = v.dir > 0 ? 0 : Math.PI; }
    else { v.obj.position.set(v.rc - v.dir * 1.25, bob, s); v.obj.rotation.y = v.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
  });
}

// ---------- your look: photo, colours ----------
let photo = null, photoSkin = '#d9a37e';
const redrawFace = () => { if (photo) setHeadCanvas(Face.buildHeadCanvas(photo, photoSkin, { zoom: Number($('face-zoom').value), dy: Number($('face-shift').value) })); };
const $ = (id) => document.getElementById(id);
const facePanel = $('face-panel'), faceToggle = $('face-toggle'), faceMsg = $('face-msg');
faceToggle.addEventListener('click', () => { const open = facePanel.hidden; facePanel.hidden = !open; faceToggle.setAttribute('aria-expanded', String(open)); });
$('shirt-color').addEventListener('input', (e) => shirtMat.color.set(e.target.value));
$('hair-color').addEventListener('input', (e) => hairMat.color.set(e.target.value));
$('face-zoom').addEventListener('input', redrawFace); $('face-shift').addEventListener('input', redrawFace);
$('face-reset').addEventListener('click', () => { photo = null; skinMat.color.set(0xd9a37e); setHeadCanvas(Face.buildDefaultHead('#d9a37e')); $('face-file').value = ''; faceMsg.textContent = 'Default face restored.'; });
$('face-file').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (!/^image\//.test(f.type)) { faceMsg.textContent = 'Please choose an image file.'; return; }
  if (f.size > 8 * 1024 * 1024) { faceMsg.textContent = 'That image is over 8 MB. Choose a smaller one.'; return; }
  const reader = new FileReader();  // data: URL (blob: images are blocked by the site's CSP); stays in this tab
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      photo = img; photoSkin = Face.averageSkin(img);
      skinMat.color.set(photoSkin); redrawFace();
      faceMsg.textContent = 'Done. Press "See my face" to look at it, and use the sliders to fit your face in the oval.';
    };
    img.onerror = () => { faceMsg.textContent = 'Could not read that image.'; };
    img.src = reader.result;
  };
  reader.onerror = () => { faceMsg.textContent = 'Could not read that file.'; };
  reader.readAsDataURL(f);
});

// ---------- inside the shops: one furnished room, re-used for every shop ----------
const IX = 600, RW = 10, RD = 8, RH = 3.4;                 // the room sits far away from the street
const interior = new THREE.Group(); interior.position.set(IX, 0, 0); scene.add(interior);
const palette = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0xf5f5f5, 0xec4899];
const wood = lam(0x6b4423);
const place = (geo, material, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); interior.add(m); return m; };
let interiorSign, interiorKeeper, interiorKeeperSprite, interiorCustomers = [], interiorPolice;
{
  const wallMat = lam(mode === 'future' ? 0x2a2478 : mode === 'past' ? 0xd6bf96 : 0xe8e0d2);
  const floorMat = lam(mode === 'future' ? 0x150f45 : mode === 'past' ? 0x8a6a45 : 0xb8a58a);
  place(planeGeo, floorMat, 0, 0, 0, RW, RD, 1).rotation.x = -Math.PI / 2;
  place(planeGeo, lam(0xf2efe8, { side: THREE.DoubleSide }), 0, RH, 0, RW, RD, 1).rotation.x = Math.PI / 2;
  place(boxGeo, wallMat, 0, RH / 2, -RD / 2, RW, RH, 0.2); place(boxGeo, wallMat, 0, RH / 2, RD / 2, RW, RH, 0.2);
  place(boxGeo, wallMat, -RW / 2, RH / 2, 0, 0.2, RH, RD); place(boxGeo, wallMat, RW / 2, RH / 2, 0, 0.2, RH, RD);
  place(boxGeo, wood, 0, 0.5, -1.6, 3.2, 1, 0.8);                                   // counter
  place(boxGeo, lam(0xa9743f), 0, 1.02, -1.6, 3.3, 0.06, 0.9);
  [-3.2, 0, 3.2].forEach((x) => {                                                   // shelves on the back wall, stocked with goods
    place(boxGeo, wood, x, 1.15, -3.75, 2.6, 2.3, 0.4);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) place(boxGeo, lam(pick(palette)), x - 1.0 + i * 0.5, 0.6 + r * 0.7, -3.5, 0.3, 0.3, 0.3);
  });
  [-1, 1].forEach((sd) => {                                                         // side shelves
    place(boxGeo, wood, sd * 4.6, 1.1, 0, 0.4, 2.2, 3.6);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) place(boxGeo, lam(pick(palette)), sd * 4.33, 0.55 + r * 0.7, -1.5 + i * 0.6, 0.28, 0.3, 0.3);
  });
  interiorSign = place(planeGeo, basic(0x333333), 0, 2.85, -3.88, 4.2, 1.05, 1);
  place(boxGeo, lam(0x3a2a1a), 0, 1.2, RD / 2 - 0.12, 1.4, 2.4, 0.1);               // exit door
  const exitC = document.createElement('canvas'); exitC.width = 128; exitC.height = 48;
  const eg = exitC.getContext('2d'); eg.fillStyle = '#052e16'; eg.fillRect(0, 0, 128, 48); eg.fillStyle = '#4ade80'; eg.font = 'bold 30px Arial, sans-serif'; eg.textAlign = 'center'; eg.textBaseline = 'middle'; eg.fillText('EXIT', 64, 26);
  const exitT = new THREE.CanvasTexture(exitC); exitT.colorSpace = THREE.SRGBColorSpace;
  place(planeGeo, basic(0xffffff, { map: exitT }), 0, 2.65, RD / 2 - 0.2, 0.8, 0.3, 1).rotation.y = Math.PI;
  const lamp = new THREE.PointLight(mode === 'future' ? 0x9be7ff : 0xfff0d0, 24, 16); lamp.position.set(0, 3, 0); interior.add(lamp);

  const person = (o, x, z, yaw) => { const pp = makePerson(o); pp.group.position.set(x, 0, z); pp.group.rotation.y = yaw; interior.add(pp.group); return pp; };
  interiorKeeper = person({ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick([0xf5f5f5, 0xfacc15, 0xfb923c, 0x34d399]), pants: pick(PANTS) }, 0, -2.8, 0);
  interiorKeeperSprite = new THREE.Sprite(bubbleMat('Rs')); interiorKeeperSprite.visible = false; interiorKeeper.group.add(interiorKeeperSprite);
  interiorCustomers = [person({ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS) }, -2.6, 0.8, Math.PI * 0.75), person({ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS) }, 2.8, -0.2, -Math.PI * 0.6)];
  interiorPolice = person({ skin: pick(SKINS), hair: 0x15110d, shirt: 0x1e3a8a, pants: 0x111827, cap: 0x1e3a8a }, 0, RD / 2 - 0.6, Math.PI); interiorPolice.group.visible = false;
}
const inCollides = (x, z) => Math.abs(x - IX) < 2.0 && z > -2.4 && z < -0.8;       // the counter and the space behind it


// ---------- inside a building: lobby, lift to every floor, roof ----------
const TX = 1500, TBASE = 3000, RHT = 3.4, MAXF = 7, TWD = 5.8, TDP = 12;
let tower = null, towerPanel = null;
const towerG = new THREE.Group(); towerG.position.set(TX, TBASE, 0); towerG.visible = false; scene.add(towerG);
const floorGroups = [], ceilMesh = new THREE.Mesh(boxGeo, lam(0xf2efe8)); ceilMesh.scale.set(TWD, 0.3, TDP); towerG.add(ceilMesh);
{
  const slabM = lam(mode === 'future' ? 0x2a2478 : 0x8c8a84), wallM = lam(mode === 'future' ? 0x3b3490 : 0xe6dfd0), liftM = lam(0x9aa3ad), glassM = basic(0xaee0ff), darkM = lam(0x1f2937);
  const at = (g, geo, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  for (let f = 0; f < MAXF; f++) {
    const g = new THREE.Group(); g.position.y = f * RHT; towerG.add(g); floorGroups.push(g);
    at(g, boxGeo, slabM, 0, -0.15, 0, TWD, 0.3, TDP);
    const wm = lam(new THREE.Color(['#e6dfd0', '#d8e4ee', '#ecd9d2', '#dde8d6', '#e8e0f0', '#f0e6c8', '#d9dde8'][f])), wms = mode === 'future' ? wallM : wm;
    at(g, boxGeo, wms, -TWD / 2, RHT / 2, 0, 0.2, RHT, TDP); at(g, boxGeo, wms, TWD / 2, RHT / 2, 0, 0.2, RHT, TDP); at(g, boxGeo, wms, 0, RHT / 2, TDP / 2, TWD, RHT, 0.2); at(g, boxGeo, wms, 0, RHT / 2, -TDP / 2, TWD, RHT, 0.2);
    [-1, 1].forEach((sd) => [-3.5, 0.5, 3.5].forEach((z) => { const w = at(g, planeGeo, glassM, sd * (TWD / 2 - 0.11), 1.7, z, 1.6, 1.3, 1); w.rotation.y = -sd * Math.PI / 2; }));
    at(g, boxGeo, liftM, 0, RHT / 2, -TDP / 2 + 1.0, 2.2, RHT, 1.6);
    const door = at(g, planeGeo, darkM, 0, 1.15, -TDP / 2 + 1.82, 1.1, 2.3, 1); door.rotation.y = 0;
    const lamp = at(g, boxGeo, basic(0xfff3c4), 0, RHT - 0.08, 1, 1.6, 0.06, 0.5);
    const pal2 = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0x8b5cf6][f % 5];
    at(g, boxGeo, lam(pal2), -1.9, 0.3, 3.8, 1.2, 0.6, 2.2); at(g, boxGeo, wood, 1.9, 0.4, 1.5, 1.0, 0.8, 1.6); at(g, boxGeo, lam(0x2f6b3a), 2.2, 0.5, -1.8, 0.5, 1.0, 0.5);
    if (f === 0) { at(g, boxGeo, lam(0x3a2a1a), 0, 1.15, TDP / 2 - 0.12, 1.5, 2.3, 0.1); }
  }
}
const towerLight = new THREE.PointLight(0xfff0d0, 26, 14); towerG.add(towerLight);
function floorLabel(f) { return f === 0 ? 'Ground' : String(f); }
function buildTowerPanel() {
  if (towerPanel) towerPanel.remove();
  towerPanel = document.createElement('div'); towerPanel.setAttribute('role', 'dialog'); towerPanel.setAttribute('aria-label', 'Lift');
  towerPanel.style.cssText = 'position:absolute;right:14px;top:50%;transform:translateY(-50%);z-index:20;background:#0b1230ee;border:1px solid #ffffff44;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px;color:#fff;font:600 14px system-ui,sans-serif';
  const h = document.createElement('div'); h.textContent = 'Lift: choose a floor'; towerPanel.appendChild(h);
  const mk = (txt, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.textContent = txt; b.addEventListener('click', fn); towerPanel.appendChild(b); };
  mk('🏙 Roof', () => leaveTower(true));
  for (let f = tower.n - 1; f >= 0; f--) mk(`Floor ${floorLabel(f)}`, () => gotoFloor(f));
  mk('Close', () => { towerPanel.hidden = true; });
  root.appendChild(towerPanel);
}
function gotoFloor(f) {
  tower.floor = f; const p = player.group.position; p.set(TX, TBASE + f * RHT, -TDP / 2 + 3.4); player.group.rotation.y = 0; yaw = Math.PI; towerPanel.hidden = true;
  say(f === 0 ? 'Ground floor lobby.' : `Floor ${f} of ${tower.n - 1}.`);
}
function enterTower(door) {
  const b = door.b, n = Math.max(2, Math.min(MAXF, Math.round(b.h / RHT)));
  tower = { b, door, n, floor: 0 }; towerG.visible = true; floorGroups.forEach((g, i) => { g.visible = i < n; }); ceilMesh.position.y = n * RHT + 0.15;
  buildTowerPanel(); towerPanel.hidden = true; player.group.position.set(TX, TBASE, TDP / 2 - 1.8); player.group.rotation.y = Math.PI; yaw = 0; pitch = 0.3;
  say(`Lobby. This building has ${n} floors. Walk to the lift and press E.`);
}
function leaveTower(toRoof) {
  const t = tower; tower = null; towerG.visible = false; if (towerPanel) towerPanel.hidden = true;
  if (toRoof) { X.standOn(t.b.solid); say('You came out on the roof. Press E at the edge to climb down.'); }
  else { player.group.position.set(t.door.x, 0, t.door.z + (t.door.z > t.b.z ? 1.0 : -1.0)); say('You left the building.'); }
  yaw = 0;
}

// ---------- state ----------
let yaw = 0, pitch = 0.35, dist = 5.2, look = null, front = false, phase = 0, moving = false;
let shop = null, talk = null, shopAlert = null, emote = null, punchT = 0, keeperBubbleT = 0, wallet = 1000, mapT = 0, photoNext = false, voiceOn = true;
const bag = [];
const keys = new Set(), pad = new Set();
const promptEl = $('world-prompt'), walletEl = $('wallet'), mapCanvas = $('minimap');
const hash = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const walletText = () => { walletEl.textContent = `Rs ${wallet} · Bag: ${bag.length ? bag.join(', ') : 'empty'}`; };
walletText();

// ---------- voices (the browser's built-in speech; nothing is sent to us) ----------
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voices = [];
const loadVoices = () => { voices = synth ? synth.getVoices().filter((v) => /^en/i.test(v.lang)) : []; };
if (synth) { loadVoices(); if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices); }
function speak(text, id, o = {}) {
  if (!voiceOn || !synth || !text) return;
  try {
    if (o.interrupt) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; if (voices.length) u.voice = voices[id % voices.length];
    u.pitch = 0.7 + (id % 7) * 0.12; u.rate = 0.92 + (id % 5) * 0.05; u.volume = o.volume == null ? 1 : o.volume;
    synth.speak(u);
  } catch { /* speech is optional */ }
}
// People nearby are heard (quieter when farther); street chatter never queues up behind itself.
function hear(a, text) {
  if (shop || !voiceOn || !synth) return;
  const pos = player.group.position, d = Math.hypot(a.x - pos.x, a.z - pos.z);
  if (d > 10) return;
  const special = Dialogue.SPEECH[text];
  if (!special && synth.speaking) return;
  speak(special || text, a.id, { volume: Math.max(0.15, 1 - d / 11), interrupt: !!special });
}
const voiceBtn = $('voice-toggle');
voiceBtn.addEventListener('click', () => { voiceOn = !voiceOn; voiceBtn.setAttribute('aria-pressed', String(!voiceOn)); voiceBtn.textContent = voiceOn ? 'Voice: on' : 'Voice: off'; if (!voiceOn && synth) synth.cancel(); });
if (!synth) { voiceBtn.textContent = 'Voice: unavailable'; voiceBtn.disabled = true; voiceOn = false; }

// ---------- entering and leaving shops ----------
function enterShop(spot) {
  X.event('shop');
  shop = { spot, name: spot.name, items: Dialogue.items(spot.name), keeperName: Dialogue.nameFor(mode, hash(spot.name)) };
  interiorSign.material = signMaterial(spot.name, TH.signBg[hash(spot.name) % TH.signBg.length]);
  const pos = player.group.position; pos.set(IX, 0, 2.0); player.group.rotation.y = Math.PI;
  yaw = 0; pitch = 0.3; promptEl.textContent = '';
  say(`Welcome to ${spot.name}!`, interiorKeeper, 3);
}
function leaveShop(msg) {
  const spot = shop.spot, pos = player.group.position;
  pos.set(spot.x + Math.sin(spot.yaw) * 1.3, 0, spot.z + Math.cos(spot.yaw) * 1.3); player.group.rotation.y = spot.yaw;
  yaw = spot.yaw + Math.PI; pitch = 0.35;
  shop = null; shopAlert = null; interiorPolice.group.visible = false; interiorKeeperSprite.visible = false;
  if (msg && tickerEl) tickerEl.textContent = msg;
}
function say(text, who, secs) { // the shopkeeper speaks: bubble plus voice
  if (who === interiorKeeper) { setBubble(interiorKeeperSprite, text); keeperBubbleT = secs || 3; }
  speak(text, hash(shop ? shop.keeperName : 'x'), { interrupt: true });
}

// ---------- what pressing E does ----------
function interactTarget(pos) {
  if (tower) {
    if (tower.floor === 0 && pos.z > TDP / 2 - 2.4) return { type: 'tower-exit', text: 'Press E to leave the building' };
    if (Math.abs(pos.x - TX) < 2.3 && pos.z < -TDP / 2 + 3.9) return { type: 'tower-lift', text: 'Press E to use the lift' };
    return null;
  }
  if (shop) {
    if (Math.hypot(pos.x - IX, pos.z - 3.5) < 1.4) return { type: 'exit', text: 'Press E to leave the shop' };
    if (Math.hypot(pos.x - IX, pos.z + 0.4) < 2.2) return { type: 'keeper', text: `Press E to talk to ${shop.keeperName} / buy` };
    return null;
  }
  if (!X.driving && !X.roof && pos.y < 1) for (const dr of doors) if (Math.hypot(dr.x - pos.x, dr.z - pos.z) < 1.7) return { type: 'tower-enter', door: dr, text: `Press E to enter this building (${Math.max(2, Math.min(MAXF, Math.round(dr.b.h / RHT)))} floors, lift to the roof)` };
  const xt = X.target(pos); if (xt) return xt;       // cars, bikes, aircraft, the prayer place
  let best = null, bd = 2.6;
  sim.agents.forEach((a) => { if (a.flyer || ['fight', 'detained', 'respond', 'cuff', 'trade'].includes(a.mode)) return; const d = Math.hypot(a.x - pos.x, a.z - pos.z); if (d < bd) { bd = d; best = a; } });
  if (best) return { type: 'talk', agent: best, text: `Press E to talk to ${best.name}` };
  let bs = null, ds = 2.4;
  shopSpots.forEach((sp) => { const d = Math.hypot(sp.x - pos.x, sp.z - pos.z); if (d < ds) { ds = d; bs = sp; } });
  return bs ? { type: 'enter', spot: bs, text: `Press E to enter ${bs.name}` } : null;
}
const frozen = () => sim.time < sim.player.detainedUntil;
function interact() {
  if (talk || frozen()) return;
  const tg = interactTarget(player.group.position);
  if (!tg) return;
  if (tg.type.startsWith('x-')) X.act(tg);
  else if (tg.type === 'enter') enterShop(tg.spot);
  else if (tg.type === 'tower-enter') enterTower(tg.door);
  else if (tg.type === 'tower-exit') leaveTower(false);
  else if (tg.type === 'tower-lift') { buildTowerPanel(); towerPanel.hidden = false; }
  else if (tg.type === 'exit') leaveShop();
  else if (tg.type === 'keeper') openTalk({ role: 'keeper', name: shop.keeperName, voice: hash(shop.keeperName), items: shop.items, shopName: shop.name });
  else if (tg.type === 'talk') {
    const a = tg.agent;
    if (!sim.hold(a)) return;
    openTalk({ role: a.role, name: a.name, voice: a.id, agent: a, items: a.role === 'keeper' && a.shop ? Dialogue.items(a.shop.name) : null, shopName: a.role === 'keeper' && a.shop ? a.shop.name : null });
  }
}

// ---------- the conversation panel ----------
const talkPanel = $('talk-panel'), talkLog = $('talk-log'), talkChips = $('talk-chips'), talkItems = $('talk-items'), talkInput = $('talk-input'), micBtn = $('talk-mic');
function addLine(who, text, mine) {
  const li = document.createElement('li'); if (mine) li.className = 'mine';
  const b = document.createElement('strong'); b.textContent = who + ': '; li.append(b, document.createTextNode(text));
  talkLog.append(li); talkLog.scrollTop = talkLog.scrollHeight;
}
function ctxFor(text) {
  const pos = player.group.position;
  const near = shop ? [] : [...new Set(shopSpots.map((sp) => ({ n: sp.name, d: Math.hypot(sp.x - pos.x, sp.z - pos.z) })).sort((x, y) => x.d - y.d).slice(0, 4).map((x) => x.n))].slice(0, 3);
  return { role: talk.role, era: mode, text, name: talk.name, year: YEAR, yearLabel: fy(YEAR), place: PLACE, shopNames: near, items: talk.items || [] };
}
function npcSays(text) { addLine(talk.name, text); speak(text, talk.voice, { interrupt: true }); }
function openTalk(info) {
  X.event('talk');
  talk = info; talkLog.replaceChildren(); talkItems.replaceChildren(); talkChips.replaceChildren();
  $('talk-name').textContent = `${info.name} · ${info.role === 'keeper' ? 'shopkeeper' + (info.shopName ? ' at ' + info.shopName : '') : info.role}`;
  Dialogue.suggestions(info.role).forEach((label) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = label; b.addEventListener('click', () => submitText(label)); talkChips.append(b); });
  if (info.items) info.items.forEach((it) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost small'; b.textContent = `Buy ${it.name} · Rs ${it.price}`; b.addEventListener('click', () => buy(it)); talkItems.append(b); });
  const fr = $('talk-friend');
  if (fr && window.TimeWarpFriends) window.TimeWarpFriends.mount(fr, { key: info.name + '|' + info.role, name: info.name, getWallet: () => wallet, spend: (n) => { wallet = Math.max(0, wallet - n); walletText(); }, say: (t) => addLine(info.name, t) });
  talkPanel.hidden = false; promptEl.textContent = '';
  npcSays(Dialogue.greeting({ era: mode, role: info.role, year: YEAR }, Math.random));
  talkInput.focus();
}
function closeTalk() {
  if (!talk) return;
  if (recog) recog.stop();
  if (talk.agent) sim.release(talk.agent);
  talk = null; talkPanel.hidden = true; if (synth) synth.cancel();
}
function submitText(text) {
  text = String(text || '').trim(); if (!text || !talk) return;
  addLine('You', text, true);
  const answer = Dialogue.reply(ctxFor(text), Math.random);
  setTimeout(() => { if (talk) npcSays(answer); }, 350);
}
function buy(it) {
  if (!talk) return;
  if (wallet < it.price) { npcSays(`Sorry, that is Rs ${it.price} and you only have Rs ${wallet}.`); return; }
  wallet -= it.price; bag.push(it.name); walletText(); X.event('buy'); document.dispatchEvent(new Event('timewarp:progress'));
  addLine('You', `I will take the ${it.name}.`, true);
  npcSays(['Thank you!', 'Here you go.', 'Enjoy!'][Math.floor(Math.random() * 3)]);
  if (shop) { keeperBubbleT = 1.5; setBubble(interiorKeeperSprite, 'Rs'); }
}
$('talk-form').addEventListener('submit', (e) => { e.preventDefault(); const v = talkInput.value; talkInput.value = ''; submitText(v); });
$('talk-close').addEventListener('click', closeTalk);
// speaking to them: the browser's speech recognition (Chrome sends the audio to Google; it asks for the microphone first)
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;
if (!SR) { micBtn.hidden = true; $('talk-lang').hidden = true; }
micBtn.addEventListener('click', () => {
  if (recog) { recog.stop(); return; }
  recog = new SR(); recog.lang = $('talk-lang').value; recog.interimResults = false; recog.maxAlternatives = 1;
  micBtn.setAttribute('aria-pressed', 'true'); micBtn.textContent = 'Listening…';
  recog.onresult = (e) => submitText(e.results[0][0].transcript);
  recog.onerror = (e) => { if (talk) addLine('System', e.error === 'not-allowed' ? 'Microphone is blocked. Allow it in the browser address bar.' : `Could not hear you (${e.error}). You can type instead.`); };
  recog.onend = () => { recog = null; micBtn.setAttribute('aria-pressed', 'false'); micBtn.textContent = 'Speak'; };
  try { recog.start(); } catch { recog = null; micBtn.setAttribute('aria-pressed', 'false'); micBtn.textContent = 'Speak'; }
});

// ---------- fighting, emotes, photo ----------
function fight() {
  if (talk || frozen() || shopAlert) return;
  if (X.noFight()) { if (tickerEl) tickerEl.textContent = 'No fighting here: not in a vehicle and never at the mosque.'; return; }
  punchT = 0.5;
  const pos = player.group.position;
  if (shop) {
    if (Math.hypot(pos.x - IX, pos.z + 0.4) < 3.2) { shopAlert = { phase: 'wait', t: 6 }; say('Help! Somebody call the police!', interiorKeeper, 6); }
    return;
  }
  let best = null, bd = 2.2;
  sim.agents.forEach((a) => { if (a.role === 'police' || a.flyer) return; const d = Math.hypot(a.x - pos.x, a.z - pos.z); if (d < bd) { bd = d; best = a; } });
  if (best) sim.engagePlayer(best);
  else if (tickerEl) tickerEl.textContent = 'Nobody is close enough to pick a fight with.';
}
function doEmote(type) { if (!talk && !frozen() && !X.driving) { emote = { type, t: type === 'dance' ? 4 : 2.2 }; X.event(type); } }
$('photo-btn').addEventListener('click', () => { photoNext = true; X.event('photo'); });
$('act-interact').addEventListener('click', interact); $('act-fight').addEventListener('click', fight);
$('act-wave').addEventListener('click', () => doEmote('wave')); $('act-dance').addEventListener('click', () => doEmote('dance'));

// ---------- keyboard / mouse / touch ----------
const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeTalk(); return; }
  if (typing() || talk) return;
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); }
  if (e.key === 'Shift') keys.add('run');
  if (e.code === 'KeyE') interact(); else if (e.code === 'KeyF') fight(); else if (e.code === 'Digit1') doEmote('wave'); else if (e.code === 'Digit2') doEmote('dance');
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); if (e.key === 'Shift') keys.delete('run'); });
addEventListener('blur', () => { keys.clear(); pad.clear(); });
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); look = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointermove', (e) => { if (!look) return; yaw -= (e.clientX - look.x) * 0.005; pitch = Math.max(0.05, Math.min(1.3, pitch + (e.clientY - look.y) * 0.004)); look.x = e.clientX; look.y = e.clientY; });
['pointerup', 'pointercancel'].forEach((ev) => canvas.addEventListener(ev, () => { look = null; }));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(2.4, Math.min(10, dist + e.deltaY * 0.004)); }, { passive: false });
document.querySelectorAll('.explore-pad button').forEach((b) => {
  const d = b.dataset.dir;
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); pad.add(d); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => pad.delete(d)));
});
const viewBtn = $('view-toggle');
viewBtn.addEventListener('click', () => { front = !front; viewBtn.setAttribute('aria-pressed', String(front)); viewBtn.textContent = front ? 'Back to normal view' : 'See my face'; });

let E = null;                                                  // the planet (world-earth.js), loaded a moment after the town
const lim = () => (E ? 1e9 : LIM);
const TOWN_R = EX / 2 + 420;
const collides = (x, z) => solids.some((s) => x > s.minX - 0.4 && x < s.maxX + 0.4 && z > s.minZ - 0.4 && z < s.maxZ + 0.4) || (E !== null && (Math.abs(x) > TOWN_R || Math.abs(z) > TOWN_R) && (E.isWater(x, z) || E.heightAt(x, z) > 9));
let qScale = 1, perfAcc = 0, perfN = 0;                       // adaptive sharpness: a slow phone gets a slightly softer picture instead of stutter
function resize() { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * qScale); renderer.setSize(innerWidth, innerHeight, false); canvas.style.width = '100%'; canvas.style.height = '100%'; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- minimap ----------
const mm = mapCanvas.getContext('2d'), MS = mapCanvas.width / EX, mx = (v) => (v + EX / 2) * MS;
function drawMap() {
  mm.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  mm.fillStyle = '#0a1030d9'; mm.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  mm.fillStyle = '#3b4660'; cs.forEach((cx) => cs.forEach((cz) => mm.fillRect(mx(cx - 7), mx(cz - 7), 14 * MS, 14 * MS)));
  sim.agents.forEach((a) => {
    mm.fillStyle = a.mode === 'fight' ? '#ef4444' : a.role === 'police' ? '#3b82f6' : a.role === 'keeper' ? '#facc15' : a.flyer ? '#a78bfa' : '#d1d5db';
    const r = a.mode === 'fight' ? 3.2 : a.role === 'keeper' ? 1.6 : 2; mm.beginPath(); mm.arc(mx(a.x), mx(a.z), r, 0, 6.29); mm.fill();
  });
  const pp = player.group.position;
  mm.save(); mm.translate(mx(pp.x), mx(pp.z)); mm.rotate(-player.group.rotation.y + Math.PI); mm.fillStyle = '#fff'; mm.beginPath(); mm.moveTo(0, -5); mm.lineTo(4, 4); mm.lineTo(-4, 4); mm.closePath(); mm.fill(); mm.restore();
  X.drawMap(mm, mx, mapCanvas.width);
}

// ---------- main loop ----------
let last = performance.now(), t = 0, raf = 0;
function animatePlayer(dt, isFrozen) {
  const p = player;
  if (isFrozen) { p.armL.rotation.x = p.armR.rotation.x = -2.9; p.legL.rotation.x = p.legR.rotation.x = 0; return; }
  if (emote) {
    emote.t -= dt;
    if (emote.t <= 0) emote = null;
    else if (emote.type === 'wave') { swing(p, 0, 0); p.armR.rotation.x = -2.6 + Math.sin(t * 8) * 0.4; return; }
    else { const s = Math.sin(t * 8); p.legL.rotation.x = s * 0.6; p.legR.rotation.x = -s * 0.6; p.armL.rotation.x = -2.2 + s * 0.6; p.armR.rotation.x = -2.2 - s * 0.6; p.group.rotation.y += dt * 3; return; }
  }
  if (punchT > 0) { punchT -= dt; swing(p, 0, 0); p.armR.rotation.x = -1.6; p.armL.rotation.x = 0.4; return; }
  if (moving) swing(p, phase, 0.6); else swing(p, 0, 0);
}
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (document.hidden) return; t += dt;
  perfAcc += (now - (loop.p || now)) / 1000; perfN++; loop.p = now;
  if (perfAcc > 2.5) { const avg = perfAcc / perfN; if (avg > 0.036 && qScale > 0.55) { qScale = Math.max(0.55, qScale - 0.15); resize(); } else if (avg < 0.019 && qScale < 1) { qScale = Math.min(1, qScale + 0.1); resize(); } perfAcc = 0; perfN = 0; }

  const pos = player.group.position, isFrozen = frozen();
  const dirs = new Set([...keys, ...pad]);
  const f = (dirs.has('f') ? 1 : 0) - (dirs.has('b') ? 1 : 0), s = (dirs.has('r') ? 1 : 0) - (dirs.has('l') ? 1 : 0);
  const R = WV.active ? WV.step(dt) : null;            // while the cartoon film plays, your recorded path moves you
  const drove = R ? false : X.update(dt, t, dirs);                 // driving or praying: the extras move you
  moving = R ? R.walking : (!drove && !!(f || s) && !isFrozen && !talk);
  if (R) { pos.x = R.x; pos.z = R.z; player.group.rotation.y = R.ry; phase += dt * 6.5; }
  else if (moving) {
    emote = null;
    const run = dirs.has('run'), speed = (run ? 5.5 : 2.6) * dt;
    let dx = -Math.sin(yaw) * f + Math.cos(yaw) * s, dz = -Math.cos(yaw) * f - Math.sin(yaw) * s;
    const len = Math.hypot(dx, dz) || 1; dx = (dx / len) * speed; dz = (dz / len) * speed;
    if (tower) {                                                   // inside a building: stay in the corridor, the lift shaft is solid
      let nx = Math.max(TX - TWD / 2 + 0.5, Math.min(TX + TWD / 2 - 0.5, pos.x + dx)), nz = Math.max(-TDP / 2 + 0.5, Math.min(TDP / 2 - 0.5, pos.z + dz));
      if (Math.abs(nx - TX) < 1.5 && nz < -TDP / 2 + 2.6) { if (Math.abs(pos.x - TX) >= 1.5) nx = pos.x; else nz = pos.z; }
      pos.x = nx; pos.z = nz;
    } else if (X.roof) {                                           // walking on a roof: stay inside its edges
      const rf = X.roof; pos.x = Math.max(rf.minX + 0.4, Math.min(rf.maxX - 0.4, pos.x + dx)); pos.z = Math.max(rf.minZ + 0.4, Math.min(rf.maxZ - 0.4, pos.z + dz)); pos.y = rf.h;
    } else if (shop) {
      const nx = Math.max(IX - 4.4, Math.min(IX + 4.4, pos.x + dx)), nz = Math.max(-3.6, Math.min(3.6, pos.z + dz));
      if (!inCollides(nx, pos.z)) pos.x = nx; if (!inCollides(pos.x, nz)) pos.z = nz;
    } else {
      const nx = Math.max(-lim(), Math.min(lim(), pos.x + dx)), nz = Math.max(-lim(), Math.min(lim(), pos.z + dz));
      if (!collides(nx, pos.z)) pos.x = nx; if (!collides(pos.x, nz)) pos.z = nz;
      if (E) E.clampWorld(pos);
    }
    const want = Math.atan2(dx, dz), cur = player.group.rotation.y;
    player.group.rotation.y = cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur)) * Math.min(1, dt * 10);
    phase += dt * (run ? 11 : 6.5);
  }
  animatePlayer(dt, isFrozen); X.post(t);

  if (!shop && !tower) { sim.player.x = pos.x; sim.player.z = pos.z; }          // the street only sees you while you are outside
  sim.step(dt); sim.agents.forEach((a) => drawAgent(a, t)); updateVehicles(t);
  const ev = sim.log[sim.log.length - 1];
  if (ev && ev !== lastLog) { lastLog = ev; if (tickerEl) tickerEl.textContent = ev.text; }

  if (shop) {                                                         // life inside the shop
    swing(interiorKeeper, 0, 0); if (keeperBubbleT > 0 && (keeperBubbleT -= dt) <= 0) interiorKeeperSprite.visible = false;
    interiorCustomers.forEach((c, i) => { swing(c, 0, 0); c.armR.rotation.x = -0.5 + Math.sin(t * 2 + i * 2) * 0.2; });
    if (shopAlert) {
      const a = shopAlert; a.t -= dt;
      if (a.phase === 'wait') {
        interiorKeeper.armL.rotation.x = interiorKeeper.armR.rotation.x = -2.6 + Math.sin(t * 10) * 0.5;
        if (a.t <= 0) { a.phase = 'come'; interiorPolice.group.visible = true; interiorPolice.group.position.set(0, 0, RD / 2 - 0.6); say('Police! Everyone calm down!', interiorKeeper, 3); }
      } else if (a.phase === 'come') {
        const pg = interiorPolice.group, tx = pos.x - IX, tz = pos.z, dx = tx - pg.position.x, dz = tz - pg.position.z, d = Math.hypot(dx, dz);
        pg.rotation.y = Math.atan2(dx, dz); swing(interiorPolice, t * 12, 0.9);
        if (d < 1.4) { a.phase = 'warn'; a.t = 4; sim.player.detainedUntil = sim.time + 4; setBubble(interiorKeeperSprite, 'STOP!'); keeperBubbleT = 3; speak('Stop! Police! Calm down, please.', 3, { interrupt: true }); }
        else { pg.position.x += (dx / d) * 3 * dt; pg.position.z += (dz / d) * 3 * dt; }
      } else if (a.phase === 'warn' && a.t <= 0) leaveShop('The police warned you and walked you out of the shop.');
    }
  }

  const d = shop || tower ? Math.min(dist, 3.2) : dist, ey = front ? yaw + Math.PI : yaw, aim = new THREE.Vector3(pos.x, pos.y + 1.45, pos.z);
  camera.position.set(aim.x + Math.sin(ey) * Math.cos(pitch) * d, aim.y + Math.sin(pitch) * d, aim.z + Math.cos(ey) * Math.cos(pitch) * d);
  if (shop) { camera.position.x = Math.max(IX - 4.6, Math.min(IX + 4.6, camera.position.x)); camera.position.z = Math.max(-3.8, Math.min(3.8, camera.position.z)); camera.position.y = Math.max(0.5, Math.min(3.0, camera.position.y)); }
  else if (!E) { camera.position.x = Math.max(-LIM - 6, Math.min(LIM + 6, camera.position.x)); camera.position.z = Math.max(-LIM - 6, Math.min(LIM + 6, camera.position.z)); }
  if (tower) { camera.position.x = Math.max(TX - 2.6, Math.min(TX + 2.6, camera.position.x)); camera.position.z = Math.max(-5.7, Math.min(5.7, camera.position.z)); const fy = TBASE + tower.floor * RHT; camera.position.y = Math.max(fy + 0.6, Math.min(fy + RHT - 0.2, camera.position.y)); towerLight.position.set(0, tower.floor * RHT + 2.9, 0); }
  camera.lookAt(aim);
  if (X.shake > 0) { const k = X.shake * 0.6; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.position.z += (Math.random() - 0.5) * k; }
  if (R) WV.cam(pos, dt);

  const tg = talk || isFrozen ? null : interactTarget(pos);
  const msg = isFrozen ? 'Police are warning you…' : tg ? tg.text : '';
  if (msg !== promptEl.textContent) promptEl.textContent = msg;
  promptEl.hidden = !msg;
  mapCanvas.hidden = !!shop || !!tower || (E !== null && (Math.abs(pos.x) > TOWN_R || Math.abs(pos.z) > TOWN_R));
  if (!shop && (mapT -= dt) <= 0) { mapT = 0.2; drawMap(); }

  if (E && !tower) { E.update(dt, pos, pos.y); E.beforeRender(pos.y); }
  renderer.render(scene, camera);
  if (E && !tower) E.afterRender();
  sky.update(dt);
  WV.afterRender();
  if (!R) WV.sample(dt, pos, !!shop);
  if (photoNext) {
    photoNext = false;
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `timewarp-${YEAR}.png`; a.click();
  }
}
const X = createExtras({ THREE, scene, camera, renderer, mode, EX, LIM, player, makePerson: makeCrowdPerson, lam, basic, boxGeo, vehicles, solids, collides, tickerEl, bag, shopSpots, root,
  addMoney: (n) => { wallet += n; walletText(); }, setCam: (y, d) => { if (y !== undefined) yaw = y; if (d !== undefined) dist = d; }, getYaw: () => yaw, Missions: window.TimeWarpMissions });
createEarth({ THREE, scene, camera, renderer, root, mode, solids, tickerEl, place: PLACE, spawnRide: (k, x, z, r) => X.spawnRide(k, x, z, r), removeRide: (r) => X.removeRide(r), lat: parseFloat(root.dataset.lat), lng: parseFloat(root.dataset.lng) })
  .then((earth) => { E = earth; X.setEarth(earth); window.__tw.E = earth; })
  .catch((err) => { console.warn('Planet data not loaded, staying in the town:', err); if (tickerEl) tickerEl.textContent = 'World map could not load. The town still works.'; });
// ---------- Save System: position, money and mission number; resumed with ?continue=1, saved on progress and every 20 s ----------
const Save = window.TimeWarpSave;
if (Save) {
  let ready = false;
  const snap = () => ({ mode, year: YEAR, destinationId: Number(root.dataset.seed) || null, x: player.group.position.x, z: player.group.position.z, money: wallet, mission: X.mission() });
  const saveNow = () => { if (ready) Save.save('world', snap()); };
  document.addEventListener('timewarp:progress', saveNow);
  setInterval(saveNow, 20000);
  if (new URLSearchParams(location.search).get('continue') === '1') {
    Save.load().then((sv) => {
      const w = sv && sv.world;
      if (w && w.mode === mode && w.year === YEAR) {
        wallet = Math.max(0, w.money | 0); walletText();
        player.group.position.set(w.x, player.group.position.y, w.z); if (E) E.clampWorld(player.group.position);
        X.setMission(w.mission | 0);
      }
    }).finally(() => { ready = true; });
  } else ready = true;
}
// ---------- Phase 5: day / night / weather / prayer times, and the car colour ----------
const sky = createSky({ scene, sun, amb: ambLight, root, canvas, mode, place: PLACE, lat: parseFloat(root.dataset.lat), lng: parseFloat(root.dataset.lng) });
{
  const pc = document.getElementById('paint-color');
  const apply = (hex) => { try { X.setPaint(hex); } catch (e) { /* ignore */ } };
  try { const v = localStorage.getItem('timewarp-paint'); if (v && /^#[0-9a-f]{6}$/i.test(v)) { if (pc) pc.value = v; apply(v); } } catch (e) { /* ignore */ }
  if (pc) pc.addEventListener('input', () => { apply(pc.value); try { localStorage.setItem('timewarp-paint', pc.value); } catch (e) { /* ignore */ } });
}
const WV = createWorldVideo({ THREE, scene, camera, renderer, canvas, root, tickerEl, player, LIM, mode, YEAR, PLACE });
statusEl.textContent = `${sim.agents.length} people (shopkeepers, police and shoppers) and ${vehicles.length} vehicles are out. Walk up to someone and press E to talk, or into a shop door to go inside.`;
setTimeout(() => { statusEl.hidden = true; }, 5000);
window.__tw = { get tower() { return tower; }, enterTower, doors, interactTarget, THREE, renderer, scene, camera, player, X, sim, solids, vehicles, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, get dist() { return dist; }, set dist(v) { dist = v; } };   // debug / test hook
raf = requestAnimationFrame(loop);
addEventListener('pagehide', () => { cancelAnimationFrame(raf); renderer.dispose(); if (synth) synth.cancel(); });
