// Realistic full-body people and real-looking vehicles for the Live World.
// The pictures are cut-outs (public/media/sprites/*.png) made from AI sheets with a green background.
// A person is NOT one picture: it has 15-18 body poses (walk, run, punch, kick, back view ...) and the
// right pose is picked every frame from what the person is doing and from where the camera is.
// Honest limit: this is "2.5D" (a standing cut-out that turns to face the camera), not a rigged 3D model.
import * as THREE from '/vendor/three/three.module.js';
import * as Models from '/js/models.js?v=18';
import { createHeroBoy } from '/js/hero-boy.js?v=2';

const BASE = '/media/sprites/';
const D = window.TimeWarpSprites;
if (!D) throw new Error('sprite-data.js did not load');
const { COLS, CELL, STAND_PX, PAD_B, FRAMES, CYCLES, IDLE_BACK, VEHICLE_LENGTH } = D;
export { FRAMES, CYCLES, VEHICLE_LENGTH };

const loader = new THREE.TextureLoader();
const cache = new Map();
function tex(url, cb) {
  let e = cache.get(url);
  if (!e) {
    e = { t: null, cbs: [] }; cache.set(url, e);
    loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; e.t = t; e.cbs.splice(0).forEach((f) => f(t)); }, undefined, () => { e.failed = true; });
  }
  if (e.t) cb(e.t); else e.cbs.push(cb);
}

const mats = new Map();                          // one material per picture, shared by everyone who uses it (cheap) and tinted by the time of day
function sharedMat(url) {
  let m = mats.get(url);
  if (!m) { m = new THREE.MeshBasicMaterial({ alphaTest: 0.45, side: THREE.DoubleSide }); m.alphaToCoverage = true; mats.set(url, m); tex(url, (t) => { m.map = t; m.needsUpdate = true; }); }
  return m;
}
const _tc = new THREE.Color();
export function setTint(color, k) {              // follow the day / night light so the cut-outs do not glow in the dark
  _tc.copy(color).lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(Math.max(0.28, Math.min(1, k)));
  mats.forEach((m) => m.color.copy(_tc));
}
const registry = new Set();                     // everything that must turn to face the camera each frame
const _fwd = new THREE.Vector3(), _cam = new THREE.Vector3();
let camRight = { x: 1, z: 0 }, camFwd = { x: 0, z: -1 };
export function beginFrame(camera) {
  camera.getWorldDirection(_fwd); const l = Math.hypot(_fwd.x, _fwd.z) || 1;
  camFwd = { x: _fwd.x / l, z: _fwd.z / l }; camRight = { x: -camFwd.z, z: camFwd.x };
  camera.getWorldPosition(_cam); Models.setCamera(_cam);
}

// ---------- people ----------
const personH = 1.78;                                              // metres the standing figure is tall
const SIZE = (CELL / STAND_PX) * personH, FOOT = (PAD_B / STAND_PX) * personH;
const shadowGeo = new THREE.CircleGeometry(0.55, 16), shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });

export const modelsReady = Models.preload().catch((e) => { console.warn('3D people unavailable:', e && e.message); return false; });   // real 3D people (models.js), used instead of the pictures when a .glb exists
export function createPerson(kind, group) {
  if (kind === 'hero') return createHeroBoy(group);                                           // the hero is a real 3D boy built in code (hero-boy.js)
  if (Models.has(kind)) return Models.createModelPerson(kind, group);                       // group = the THREE.Group of the person (moves and turns like before)
  const names = FRAMES[kind], rows = Math.ceil(names.length / COLS), cyc = CYCLES[kind];
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
  const mat = sharedMat(`${BASE}${kind}.png`);
  const mesh = new THREE.Mesh(geo, mat); mesh.scale.set(SIZE, SIZE, 1); mesh.position.y = -FOOT; mesh.frustumCulled = false;
  const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03;
  const root = new THREE.Group(); root.add(shadow, mesh); group.add(root);
  const uvAttr = geo.attributes.uv;
  let curName = '', curFlip = null, flip = false, clock = Math.random() * 10;
  const setFrame = (name, fl) => {
    if (name === curName && fl === curFlip) return;
    let i = names.indexOf(name); if (i < 0) i = 0;
    const c = i % COLS, r = Math.floor(i / COLS), u0 = c / COLS, u1 = (c + 1) / COLS, v0 = 1 - (r + 1) / rows, v1 = 1 - r / rows;
    const a = fl ? u1 : u0, b = fl ? u0 : u1;
    uvAttr.setXYZ(0, a, v1, 0); uvAttr.setXYZ(1, b, v1, 0); uvAttr.setXYZ(2, a, v0, 0); uvAttr.setXYZ(3, b, v0, 0); uvAttr.needsUpdate = true;
    curName = name; curFlip = fl;
  };
  setFrame('idle', false);
  const actor = {
    kind, root, mesh, group,
    // pose: 'idle' | 'walk' | 'run' | 'punch' | 'kick' | 'handsup' | 'talk' | 'wave' | 'dance' | 'pray' | 'hurt'
    update(pose, speed, t, opts = {}) {
      if (!mat.map) return;
      const ry = group.rotation.y, hx = Math.sin(ry), hz = Math.cos(ry);          // the way the person faces (world)
      const dotF = hx * camFwd.x + hz * camFwd.z, dotR = hx * camRight.x + hz * camRight.z;   // dotF > 0: walking away from the camera
      if (Math.abs(dotR) > 0.2) flip = dotR < 0;                                  // the pictures face right; mirror them for left (hysteresis stops flicker)
      const isHero = kind === 'hero';                                             // the hero only has a side view: never switch to a back view, narrow a little when seen from front/behind
      let away = dotF > 0.55 && !opts.side && !isHero;
      let list = null, fps = 6, bob = 0, sway = 0;
      switch (pose) {
        case 'walk': list = away ? cyc.backwalk : cyc.walk; fps = isHero ? 7 + speed * 1.2 : 3 + speed * 2.2; bob = isHero ? 0.012 : 0.035; break;
        case 'run': list = away ? [...cyc.backwalk, ...cyc.backwalk] : cyc.run; fps = isHero ? 12 : 9; bob = isHero ? 0.02 : 0.06; sway = isHero ? 0.02 : 0.03; break;
        case 'punch': case 'kick': case 'handsup': case 'talk': case 'wave': case 'dance': case 'pray': case 'hurt': list = cyc[pose]; fps = pose === 'dance' ? 5 : pose === 'talk' ? 2.2 : pose === 'wave' ? 3 : 7; away = false; if (pose === 'dance') { bob = 0.07; flip = Math.floor(t * 2.5) % 2 === 0; } break;
        default: list = null;
      }
      const k = Math.floor((t + clock) * fps);
      let name;
      if (list) name = list[((k % list.length) + list.length) % list.length];
      else name = away ? IDLE_BACK[kind] : 'idle';
      setFrame(name, flip);
      // the figure stays upright and always turns its face to the camera
      const px = group.position.x, pz = group.position.z;
      mesh.rotation.y = Math.atan2(_cam.x - px, _cam.z - pz) - ry;
      if (isHero) mesh.scale.x = SIZE * (0.74 + 0.26 * Math.min(1, Math.abs(dotR)));
      const step = list && bob ? Math.abs(Math.sin((t + clock) * fps * Math.PI / (list.length > 2 ? 2 : 1))) : 0;
      mesh.position.y = -FOOT + step * bob * 2 * personH / 1.78;
      mesh.rotation.z = sway ? Math.sin((t + clock) * fps * 1.6) * sway : 0;
      shadow.rotation.z = 0;
    },
    dispose() { geo.dispose(); group.remove(root); },
  };
  return actor;
}

// A drop-in for the old blocky person: same fields (group + 4 limbs) so the old code never breaks.
export function makeSpritePerson(kind) {
  const group = new THREE.Group(), dummy = () => new THREE.Object3D();
  const actor = createPerson(kind, group);
  return { group, legL: dummy(), legR: dummy(), armL: dummy(), armR: dummy(), flames: [], actor };
}

// ---------- vehicles ----------
export function createBillboard(name, length, opts = {}) {
  const g = new THREE.Group(), anchor = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ visible: false }));
  anchor.visible = false; g.add(anchor);                                         // child 0 = the "body" the old paint code looks at; harmless
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
  const mat = sharedMat(`${BASE}v-${name}.png`);
  const mesh = new THREE.Mesh(geo, mat); mesh.visible = false; mesh.frustumCulled = false; g.add(mesh);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.scale.set(length * 0.42, length * (opts.air ? 0.3 : 0.17), 1); shadow.visible = !opts.air; g.add(shadow);
  tex(`${BASE}v-${name}.png`, (t) => { mesh.scale.set(length, length * t.image.height / t.image.width, 1); mesh.position.y = opts.lift || 0; mesh.visible = true; });
  let flip = false, phase = Math.random() * 10, lastX = null, lastZ = null, spd = 0, pitch = 0;
  const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const b = {
    group: g, mesh, name, forward: opts.forward || 'x',
    update(t = performance.now() / 1000, dt = 0.016) {
      if (!mesh.visible || !g.visible) return;
      const ry = g.rotation.y, fx = Math.cos(ry), fz = -Math.sin(ry);              // the vehicle's nose points along +x of its group
      const dR = fx * camRight.x + fz * camRight.z;
      if (Math.abs(dR) > 0.25) flip = dR > 0;                                      // the pictures face left; mirror them when the vehicle goes right
      mesh.scale.x = Math.abs(mesh.scale.x) * (flip ? -1 : 1);
      // side-on: stay lined up with the road (correct perspective). End-on: turn to the camera so it never becomes a thin sliver.
      const toCam = wrapPi(Math.atan2(_cam.x - g.position.x, _cam.z - g.position.z) - ry), side = Math.min(1, Math.abs(dR) * 1.15);
      mesh.rotation.y = toCam * (1 - side * side);
      // measured speed (m/s) drives the suspension, so a stopped car stands still and a fast one rocks
      if (lastX !== null && dt > 0) { const v = Math.hypot(g.position.x - lastX, g.position.z - lastZ) / dt; spd += (Math.min(v, 14) - spd) * Math.min(1, dt * 5); }
      lastX = g.position.x; lastZ = g.position.z;
      if (opts.air) { mesh.rotation.z = Math.sin(t * 0.9 + phase) * 0.03; return; }   // aircraft: gentle roll only
      const k = Math.min(1, spd / 8), h = length > 6 ? 0.45 : 1;                    // buses move less than cars
      const bounce = (Math.sin(t * 13 + phase) * 0.6 + Math.sin(t * 7.3 + phase * 1.7) * 0.4) * 0.025 * k * h;   // road bumps
      pitch += (Math.sin(t * 5 + phase) * 0.012 * k * h - pitch) * Math.min(1, dt * 8);
      mesh.position.y = (opts.lift || 0) + Math.abs(bounce);
      mesh.rotation.z = pitch * (flip ? -1 : 1);
      const sh = 1 - Math.abs(bounce) * 2;                                         // shadow squeezes with the bounce
      shadow.scale.set(length * 0.42 * sh, length * 0.17 * sh, 1);
    },
  };
  g.userData.billboard = b; registry.add(b);
  return g;
}
export const unregister = (g) => { if (g.userData.billboard) registry.delete(g.userData.billboard); };
export function updateBillboards(t, dt) { registry.forEach((b) => b.update(t, dt)); }
