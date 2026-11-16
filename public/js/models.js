// Real 3D people (rigged .glb models with a skeleton) for the Live World.
// Unlike the picture cut-outs in sprites.js these turn with the walking direction, so the face always points
// where the person walks and the legs and arms really move.
//
// Files (made automatically available by GET /media/models/index.json):
//   public/media/models/man.glb | woman.glb | police.glb      the character (Mixamo "With Skin", converted to .glb)
//   public/media/models/anims/<pose>.glb                      optional Mixamo animations ("Without Skin"), shared by everybody
//   public/media/models/anims/<man|woman|police>-<pose>.glb   optional animation for just one character
// <pose> is one of: idle walk run punch kick wave talk dance hurt pray handsup
// Whatever is missing is replaced: no idle -> a still frame of the walk, no run -> a faster walk,
// no punch/kick/wave/... -> a simple bone pose made in code.
import * as THREE from '/vendor/three/three.module.js';
import { GLTFLoader } from '/vendor/three-addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '/vendor/three-addons/utils/SkeletonUtils.js';

const FILE = { male: 'man', female: 'woman', police: 'police' };
const POSES = ['idle', 'walk', 'run', 'punch', 'kick', 'wave', 'talk', 'dance', 'hurt', 'pray', 'handsup'];
const HIDE = { man: /teeth|caruncula|hat/i };            // parts of a model that are not wanted (the Mixamo mocap guy wears a marker cap)
const HEIGHT = 1.78;                                     // metres, same as the picture people
const templates = new Map();                             // kind -> [ { scene, fit, footY, clips: { pose: AnimationClip } } ]  (woman.glb, woman2.glb ... are different girls)

export const has = (kind) => templates.has(kind);
const camPos = new THREE.Vector3(1e9, 0, 1e9), _wp = new THREE.Vector3();
export const setCamera = (v) => { camPos.copy(v); };       // called every frame by sprites.js (people far away are not drawn or animated: saves the graphics card)
const FAR = 60;
export const kinds = () => [...templates.keys()];

function stripScale(clip) {                              // some converters add scale tracks; they only cause trouble
  clip.tracks = clip.tracks.filter((t) => !/\.scale$/.test(t.name));
  return clip;
}
function inPlace(clip) {                                 // walking and running must not move the hips away from the person
  clip.tracks.forEach((t) => {
    if (/Hips\.position$/.test(t.name)) { const v = t.values, x = v[0], z = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x; v[i + 2] = z; } }
  });
  return clip;
}
function classify(clips) {                               // clips that come inside the model file
  const out = {};
  clips.forEach((c) => {
    const n = c.name || '';
    const key = /idle|stand|breath/i.test(n) ? 'idle' : /run|jog|sprint/i.test(n) ? 'run' : /walk/i.test(n) ? 'walk' : /punch|jab/i.test(n) ? 'punch' : /kick/i.test(n) ? 'kick' : /wav/i.test(n) ? 'wave' : /danc|samba/i.test(n) ? 'dance' : null;
    if (key && !out[key]) out[key] = c;
  });
  if (!out.walk) { const c = clips.find((x) => !/t-?pose/i.test(x.name) && x.duration > 0.4); if (c) out.walk = c; }   // Mixamo names a single download "mixamo.com" (or "Take 001"): use it as the walk
  return out;
}

function bone(root, name) { return root.getObjectByName('mixamorig' + name) || root.getObjectByName(name) || null; }

function stillFrom(clip, template) {                     // a standing pose: the moment of the walk when both feet are lowest and closest
  try {
    const m = cloneSkinned(template), mixer = new THREE.AnimationMixer(m), a = mixer.clipAction(clip); a.play();
    const L = bone(m, 'LeftFoot'), R = bone(m, 'RightFoot'); if (!L || !R) return null;
    const pl = new THREE.Vector3(), pr = new THREE.Vector3(); let best = 0, bestScore = Infinity; const N = 30;
    for (let i = 0; i < N; i++) {
      mixer.setTime(clip.duration * i / N); m.updateMatrixWorld(true);
      L.getWorldPosition(pl); R.getWorldPosition(pr);
      const score = Math.abs(pl.z - pr.z) + Math.max(pl.y, pr.y) * 1.5 + Math.abs(pl.y - pr.y);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    const fps = 30, f = Math.round(clip.duration * best / N * fps);
    return THREE.AnimationUtils.subclip(clip, 'idle-still', f, f + 2, fps);
  } catch (e) { return null; }
}

export async function preload() {
  if (/[?&]nomodels=1/.test(location.search)) return false;
  let list;
  try { const r = await fetch('/media/models/index.json'); if (!r.ok) return false; list = await r.json(); } catch (e) { return false; }
  if (!list.models || !list.models.length) return false;
  const loader = new GLTFLoader();
  const load = (u) => loader.loadAsync(u).catch((e) => { console.warn('model not loaded:', u, e && e.message); return null; });
  const animCache = new Map();
  const loadAnim = (file) => { if (!animCache.has(file)) animCache.set(file, load('/media/models/anims/' + file).then((g) => g && g.animations[0] ? inPlace(stripScale(g.animations[0].clone())) : null)); return animCache.get(file); };
  await Promise.all(list.models.map(async (file) => {
    const base = file.replace(/\.glb$/i, ''), stem = base.replace(/\d+$/, ''), kind = Object.keys(FILE).find((k) => FILE[k] === stem);   // woman2.glb = another woman
    if (!kind) return;
    const gl = await load('/media/models/' + file); if (!gl) return;
    const scene = gl.scene, hide = HIDE[stem];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (hide && hide.test(o.name)) { o.visible = false; return; }
      o.frustumCulled = false;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.isMeshStandardMaterial) { m.metalness = 0; m.roughness = Math.max(m.roughness, 0.75); } });
    });
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3(); scene.traverse((o) => { if (o.isMesh && o.visible) box.expandByObject(o); });
    const h = box.max.y - box.min.y || 1.8, fit = HEIGHT / h, footY = -box.min.y * fit;
    const clips = {}; const own = classify(gl.animations.map((a) => stripScale(a.clone())));
    Object.entries(own).forEach(([k, c]) => { clips[k] = (k === 'walk' || k === 'run') ? inPlace(c) : c; });
    await Promise.all(POSES.map(async (p) => {
      const names = (list.anims || []);
      const f = names.includes(`${base}-${p}.glb`) ? `${base}-${p}.glb` : names.includes(`${stem}-${p}.glb`) ? `${stem}-${p}.glb` : names.includes(`${p}.glb`) ? `${p}.glb` : null;
      if (f) { const c = await loadAnim(f); if (c) clips[p] = c; }
    }));
    if (!clips.idle && clips.walk) { const s = stillFrom(clips.walk, scene); if (s) clips.idle = s; }
    if (!templates.has(kind)) templates.set(kind, []); templates.get(kind).push({ scene, fit, footY, clips, base });
  }));
  return templates.size > 0;
}

// ---------- the actor: same interface as the picture people in sprites.js ----------
const shadowGeo = new THREE.CircleGeometry(0.55, 16), shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
const PROC = ['punch', 'kick', 'wave', 'talk', 'dance', 'hurt', 'pray', 'handsup'];     // poses that are made in code when the model has no clip for them
const _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _m = new THREE.Quaternion(), _a = new THREE.Vector3(), _e = new THREE.Euler();

export function createModelPerson(kind, group) {
  const list = templates.get(kind), T = list[Math.floor(Math.random() * list.length)];   // each person gets one of the models of that kind
  const root = new THREE.Group(), model = cloneSkinned(T.scene);
  const k = 0.96 + Math.random() * 0.09;                  // people are not all exactly the same height
  model.scale.setScalar(T.fit * k); model.position.y = T.footY * k;
  const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03;
  root.add(shadow, model); group.add(root);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {}; const getAct = (p) => { if (!actions[p] && T.clips[p]) { actions[p] = mixer.clipAction(T.clips[p]); actions[p].setLoop(THREE.LoopRepeat, Infinity); } return actions[p] || null; };
  const B = {}; ['Hips', 'Spine', 'Spine1', 'Spine2', 'Head', 'RightArm', 'RightForeArm', 'LeftArm', 'LeftForeArm', 'RightUpLeg', 'RightLeg', 'LeftUpLeg', 'LeftLeg'].forEach((n) => { B[n] = bone(model, n); });
  let cur = null, curKey = '', last = null, phase = Math.random() * 6;
  // rotate a bone by `ang` radians around an axis given in the person's own frame (x = to the person's left, y = up, z = forward)
  const turn = (name, ax, ay, az, ang) => {
    const b = B[name]; if (!b || !b.parent) return;
    model.getWorldQuaternion(_m); b.parent.getWorldQuaternion(_p);
    _a.set(ax, ay, az).normalize().applyQuaternion(_m);                        // axis in the world
    _q.setFromAxisAngle(_a, ang);                                              // rotation in the world
    _p.invert(); _q.premultiply(_p); b.parent.getWorldQuaternion(_m); _q.multiply(_m);   // = parentWorld^-1 * R * parentWorld
    b.quaternion.premultiply(_q);
    b.updateMatrixWorld(true);
  };
  const procedural = (pose, t) => {
    model.updateMatrixWorld(true);
    const s = Math.sin(t * 8), c = Math.sin(t * 5);
    switch (pose) {
      case 'handsup': turn('LeftArm', 0, 0, 1, -2.5); turn('RightArm', 0, 0, 1, 2.5); break;
      case 'wave': turn('RightArm', 0, 0, 1, 2.3); turn('RightForeArm', 0, 0, 1, 0.5 + s * 0.45); break;
      case 'talk': turn('RightArm', 1, 0, 0, -0.6 + c * 0.12); turn('RightForeArm', 1, 0, 0, -0.9 + s * 0.15); turn('Head', 1, 0, 0, c * 0.05); break;
      case 'punch': { const e = 0.5 + 0.5 * Math.sin(t * 10); turn('Spine1', 0, 1, 0, 0.35 * e); turn('RightArm', 1, 0, 0, -1.5 * e); turn('LeftArm', 1, 0, 0, -0.7); turn('LeftForeArm', 1, 0, 0, -1.2); break; }
      case 'kick': { const e = 0.5 + 0.5 * Math.sin(t * 8); turn('RightUpLeg', 1, 0, 0, -1.25 * e); turn('Spine1', 1, 0, 0, 0.2 * e); turn('LeftArm', 0, 0, 1, -0.8); turn('RightArm', 0, 0, 1, 0.8); break; }
      case 'hurt': turn('Spine', 1, 0, 0, 0.35); turn('Spine1', 1, 0, 0, 0.3); turn('Head', 1, 0, 0, 0.3); turn('RightArm', 1, 0, 0, -0.9); turn('LeftArm', 1, 0, 0, -0.9); break;
      case 'dance': {
        const u = Math.sin(t * 4);
        turn('Hips', 0, 1, 0, u * 0.35); turn('Spine1', 0, 1, 0, -u * 0.3);
        turn('LeftArm', 0, 0, 1, -1.7 + Math.sin(t * 8) * 0.5); turn('RightArm', 0, 0, 1, 1.7 - Math.sin(t * 8 + 1) * 0.5);
        model.position.y = T.footY * k + Math.abs(Math.sin(t * 4)) * 0.07; break;
      }
      case 'pray': turn('Spine', 1, 0, 0, 0.45); turn('Head', 1, 0, 0, 0.35); turn('RightArm', 1, 0, 0, -0.9); turn('LeftArm', 1, 0, 0, -0.9); turn('RightForeArm', 1, 0, 0, -1.4); turn('LeftForeArm', 1, 0, 0, -1.4); break;
      default: break;
    }
  };
  const actor = {
    kind, root, mesh: model, group, models3d: true,
    update(pose, speed, t, opts = {}) {
      if (!opts.always) { group.getWorldPosition(_wp); const far = _wp.distanceToSquared(camPos) > FAR * FAR && camPos.x < 1e8; if (far !== !model.visible) { model.visible = !far; shadow.visible = !far; } if (far) return; }
      const dt = last === null ? 0.016 : Math.min(0.1, Math.max(0, t - last)); last = t;
      let key = pose, ts = 1, lean = 0;
      if (pose === 'walk') { ts = Math.max(0.7, Math.min(1.5, (speed || 1.2) / 1.2)); }
      else if (pose === 'run') { if (T.clips.run) key = 'run'; else { key = 'walk'; ts = 1.9; } lean = 0.12; }
      else if (PROC.includes(pose) && !T.clips[pose]) key = 'idle';
      if (!T.clips[key]) key = T.clips.idle ? 'idle' : T.clips.walk ? 'walk' : '';
      const next = key ? getAct(key) : null;
      if (next && next !== cur) {
        next.reset().setEffectiveWeight(1).play();
        if (cur) cur.crossFadeTo(next, 0.22, false);
        cur = next; curKey = key;
        if (key === 'walk' || key === 'run') next.time = ((phase) % 1) * next.getClip().duration;
      }
      if (cur) cur.setEffectiveTimeScale(ts);
      model.position.y = T.footY * k;
      mixer.update(dt);
      if (PROC.includes(pose) && !T.clips[pose]) procedural(pose, t + phase);
      model.rotation.x = lean;                            // running leans forward a little
    },
    dispose() { mixer.stopAllAction(); group.remove(root); },
  };
  return actor;
}
