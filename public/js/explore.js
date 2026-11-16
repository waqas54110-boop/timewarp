import * as THREE from '/vendor/three/three.module.js';

const root = document.getElementById('explore');
const canvas = document.getElementById('explore-canvas');
const statusEl = document.getElementById('explore-status');
const mode = root.dataset.mode;
const seed0 = Number(root.dataset.year) * 31 + Number(root.dataset.seed);
const modelUrl = root.dataset.model || '';

['.site-header', '.site-footer', '.skip'].forEach((s) => { const n = document.querySelector(s); if (n) n.inert = true; });

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}
if (!hasWebGL()) { statusEl.textContent = 'Your browser cannot show 3D graphics. Use "Back to scene".'; throw new Error('no webgl'); }

const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rand = rng(seed0);

const THEME = {
  future: { sky: 0x0a0620, fog: 0x160a3a, fogD: 0.012, ground: 0x0b0820, bld: 0x15123c, lit: true, sun: 0x8f7bff, sunI: 0.5, amb: 0x4b3b9a, hMin: 14, hMax: 60 },
  present: { sky: 0x86c5ff, fog: 0xa9d6ff, fogD: 0.008, ground: 0x3d4452, bld: 0x8d99b5, lit: true, sun: 0xffffff, sunI: 1.1, amb: 0xbfd8ff, hMin: 6, hMax: 28 },
  past: { sky: 0xe8b26a, fog: 0xc98f4c, fogD: 0.014, ground: 0x7a5530, bld: 0xb98550, lit: false, sun: 0xffc27a, sunI: 1.2, amb: 0xffd9a8, hMin: 3, hMax: 8 },
}[mode] || null;
const T = THEME;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color(T.sky);
scene.fog = new THREE.FogExp2(T.fog, T.fogD);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
camera.position.set(0, 1.7, 22);
scene.add(new THREE.AmbientLight(T.amb, 0.7));
const sun = new THREE.DirectionalLight(T.sun, T.sunI); sun.position.set(-30, 40, 20); scene.add(sun);

const PITCH = 22, CELLS = 15, HALF = (CELLS * PITCH) / 2;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 200, HALF * 2 + 200), new THREE.MeshStandardMaterial({ color: T.ground, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
if (mode === 'future') {
  const grid = new THREE.GridHelper(HALF * 2, CELLS * 2, 0x22d3ee, 0x3b2f8f); grid.position.y = 0.02; grid.material.transparent = true; grid.material.opacity = 0.25; scene.add(grid);
}

// ---------- city ----------
const solids = [];            // AABBs for collision
const cityGroup = new THREE.Group(); scene.add(cityGroup);

function windowTexture(repeatY) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#0a0a1c'; g.fillRect(0, 0, 64, 128);
  const pal = mode === 'future' ? ['#67e8f9', '#c4b5fd', '#f0abfc'] : ['#fde68a', '#e0f2fe', '#fcd34d'];
  for (let y = 6; y < 124; y += 12) for (let x = 6; x < 58; x += 12) if (rand() < 0.45) { g.fillStyle = pal[(rand() * 3) | 0]; g.fillRect(x, y, 6, 8); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, repeatY); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const mats = [];
for (let k = 1; k <= 5; k++) {
  if (T.lit) { const tex = windowTexture(k * 2); mats.push(new THREE.MeshStandardMaterial({ color: T.bld, map: tex, emissive: mode === 'future' ? 0xffffff : 0x222222, emissiveMap: mode === 'future' ? tex : null, emissiveIntensity: mode === 'future' ? 0.9 : 0.3, roughness: 0.7 })); }
  else mats.push(new THREE.MeshStandardMaterial({ color: new THREE.Color(T.bld).offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.12), roughness: 1 }));
}

function addBox(w, h, d, x, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, h / 2, z); cityGroup.add(m);
  solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  return m;
}

function buildCity() {
  for (let i = 0; i < CELLS; i++) for (let j = 0; j < CELLS; j++) {
    const cx = (i - (CELLS - 1) / 2) * PITCH, cz = (j - (CELLS - 1) / 2) * PITCH;
    if (Math.abs(cx) < PITCH * 1.1 && Math.abs(cz) < PITCH * 1.1) continue; // central plaza stays open
    const n = 1 + ((rand() * 3) | 0);
    for (let b = 0; b < n; b++) {
      const w = 5 + rand() * 6, d = 5 + rand() * 6, h = T.hMin + rand() * (T.hMax - T.hMin);
      const x = cx + (rand() - 0.5) * 6, z = cz + (rand() - 0.5) * 6;
      const mat = mats[Math.min(mats.length - 1, Math.floor(h / (T.hMax / 5)))];
      addBox(w, h, d, x, z, mat);
      if (mode === 'past') { addBox(w + 0.4, 0.5, d + 0.4, x, z, mats[0]).position.y = h + 0.25; }
      if (mode === 'future' && rand() < 0.3) { const sp = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22d3ee })); sp.position.set(x, h + 4, z); cityGroup.add(sp); }
    }
  }
  landmark();
}

function landmark() {
  if (mode === 'future') {
    const core = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.6, 70, 12), new THREE.MeshStandardMaterial({ color: 0x1b1650, emissive: 0x6d28d9, emissiveIntensity: 0.8 }));
    core.position.set(0, 35, 0); cityGroup.add(core); solids.push({ minX: -2.7, maxX: 2.7, minZ: -2.7, maxZ: 2.7 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.25, 8, 48), new THREE.MeshBasicMaterial({ color: 0x22d3ee })); ring.position.y = 45; ring.rotation.x = Math.PI / 2; cityGroup.add(ring);
    [[12, 0x22d3ee], [-12, 0xa78bfa], [0, 0xf0abfc]].forEach(([x, c], i) => { const l = new THREE.PointLight(c, 40, 40); l.position.set(x, 6, i * 6 - 6); scene.add(l); });
  } else if (mode === 'past') {
    const stone = new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: 1 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), stone); dome.position.set(0, 9, -6); cityGroup.add(dome);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 9, 28), stone); drum.position.set(0, 4.5, -6); cityGroup.add(drum); solids.push({ minX: -6, maxX: 6, minZ: -12, maxZ: 0 });
    [-9, 9].forEach((x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 16, 12), stone); m.position.set(x, 8, 4); cityGroup.add(m); solids.push({ minX: x - 0.9, maxX: x + 0.9, minZ: 3.1, maxZ: 4.9 }); });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(9, 0.9, 10, 32, Math.PI), stone); arch.position.set(0, 14, 4); cityGroup.add(arch);
    for (let i = -10; i <= 10; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), stone); m.position.set(i * 1.8, 11.2, -HALF + 6); cityGroup.add(m); }
    addBox(HALF * 2 - 12, 10.5, 2, 0, -HALF + 6, stone);
  } else {
    addBox(8, 60, 8, 0, 0, mats[4]);
  }
}

// ---------- ambience: flying vehicles / dust ----------
const movers = [];
function ambience() {
  if (mode === 'future') {
    const geo = new THREE.BoxGeometry(1.6, 0.4, 0.6);
    for (let i = 0; i < 40; i++) {
      const c = [0x67e8f9, 0xf0abfc, 0xc4b5fd][i % 3];
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c }));
      const lane = (((rand() * CELLS) | 0) - CELLS / 2) * PITCH + PITCH / 2 + 0;
      const alongX = rand() < 0.5;
      m.position.set(alongX ? (rand() - 0.5) * HALF * 2 : lane + 8, 12 + rand() * 25, alongX ? lane + 8 : (rand() - 0.5) * HALF * 2);
      m.rotation.y = alongX ? 0 : Math.PI / 2;
      m.userData = { v: (rand() < 0.5 ? -1 : 1) * (8 + rand() * 14), alongX };
      scene.add(m); movers.push(m);
    }
  } else if (mode === 'past') {
    const N = 500, p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { p[i * 3] = (rand() - 0.5) * 120; p[i * 3 + 1] = rand() * 20; p[i * 3 + 2] = (rand() - 0.5) * 120; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe2b0, size: 0.12, transparent: true, opacity: 0.6 }));
    dust.userData.dust = true; scene.add(dust); movers.push(dust);
  }
}

// ---------- optional .glb ----------
async function loadModel() {
  statusEl.textContent = 'Loading 3D model…';
  const { GLTFLoader } = await import('/vendor/three-addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(modelUrl);
  const m = gltf.scene;
  const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
  m.scale.setScalar(60 / Math.max(size.x, size.y, size.z, 0.001));
  box.setFromObject(m); const c = box.getCenter(new THREE.Vector3());
  m.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  scene.add(m);
}

(async () => {
  let modelOk = false;
  if (modelUrl) { try { await loadModel(); modelOk = true; } catch (e) { console.error(e); statusEl.textContent = 'Could not load the 3D model; showing a generated city instead.'; } }
  if (!modelOk) buildCity();
  ambience();
  if (modelOk || !modelUrl) setTimeout(() => { if (!statusEl.textContent.startsWith('Could not')) statusEl.hidden = true; }, 600);
})();

// ---------- controls ----------
let yaw = 0, pitch = 0, look = null;
const keys = new Set(), pad = new Set();
const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
addEventListener('keydown', (e) => { if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); } if (e.key === 'Shift') keys.add('run'); });
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); if (e.key === 'Shift') keys.delete('run'); });
addEventListener('blur', () => { keys.clear(); pad.clear(); });
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); look = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointermove', (e) => {
  if (!look) return;
  yaw -= (e.clientX - look.x) * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - look.y) * 0.004));
  look.x = e.clientX; look.y = e.clientY;
});
canvas.addEventListener('pointerup', () => { look = null; });
canvas.addEventListener('pointercancel', () => { look = null; });
document.querySelectorAll('.explore-pad button').forEach((b) => {
  const d = b.dataset.dir;
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); pad.add(d); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => pad.delete(d)));
});

function collides(x, z) {
  const r = 0.5;
  return solids.some((s) => x > s.minX - r && x < s.maxX + r && z > s.minZ - r && z < s.maxZ + r);
}

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let last = performance.now(), raf = 0, t = 0;
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  if (document.hidden) return;
  const dirs = new Set([...keys, ...pad]);
  const speed = (dirs.has('run') ? 11 : 5.5) * dt;
  const fwd = (dirs.has('f') ? 1 : 0) - (dirs.has('b') ? 1 : 0), str = (dirs.has('r') ? 1 : 0) - (dirs.has('l') ? 1 : 0);
  if (fwd || str) {
    const dx = (-Math.sin(yaw) * fwd + Math.cos(yaw) * str) * speed, dz = (-Math.cos(yaw) * fwd - Math.sin(yaw) * str) * speed;
    const nx = Math.max(-HALF + 2, Math.min(HALF - 2, camera.position.x + dx)), nz = Math.max(-HALF + 2, Math.min(HALF - 2, camera.position.z + dz));
    if (!collides(nx, camera.position.z)) camera.position.x = nx;
    if (!collides(camera.position.x, nz)) camera.position.z = nz;
    camera.position.y = 1.7 + Math.sin(t * 9) * 0.04;
  }
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  movers.forEach((m) => {
    if (m.userData.dust) { m.rotation.y += dt * 0.02; return; }
    const p = m.userData.alongX ? 'x' : 'z';
    m.position[p] += m.userData.v * dt;
    if (m.position[p] > HALF) m.position[p] = -HALF; if (m.position[p] < -HALF) m.position[p] = HALF;
  });
  renderer.render(scene, camera);
}
raf = requestAnimationFrame(loop);
addEventListener('pagehide', () => { cancelAnimationFrame(raf); renderer.dispose(); });
