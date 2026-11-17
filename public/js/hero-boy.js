// The hero: a real 3D boy built in code (black hoodie with hood, black cargo pants, white sneakers, brown hair).
// He is made of body parts that bend at the hip, knee, shoulder, elbow and neck, so the whole body moves when he walks,
// and he always faces the way he walks (the group turns, nothing is a flat picture).
// Same interface as the other people: { kind, root, mesh, group, update(pose, speed, t, opts), dispose() }.
import * as THREE from '/vendor/three/three.module.js';

const SKIN = 0xe9b690, HAIR = 0x3a2416, HOODIE = 0x24262c, PANTS = 0x1a1b20, SHOE = 0xf1f1f3, SOLE = 0xc9c9cf, DARK = 0x15110f;
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const shadowGeo = new THREE.CircleGeometry(0.55, 16), shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });

export function createHeroBoy(group) {
  const skin = lam(SKIN), hair = lam(HAIR), hoodie = lam(HOODIE), pants = lam(PANTS), shoe = lam(SHOE), sole = lam(SOLE), dark = lam(DARK), white = lam(0xeeeeee);
  const mats = [skin, hair, hoodie, pants, shoe, sole, dark, white];
  const geos = [shadowGeo];
  const mesh = (geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; };
  const pivot = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };

  const root = new THREE.Group(), body = new THREE.Group();
  const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03;
  root.add(shadow, body); root.scale.setScalar(0.975); group.add(root);

  // ---- hips and legs (facing +z, the boy's left is +x) ----
  body.add(mesh(new THREE.SphereGeometry(0.15, 16, 12), pants, 0, 0.95, 0, 1.2, 0.8, 0.85));
  const legs = [1, -1].map((side) => {
    const thigh = pivot(side * 0.095, 0.95, 0), shin = pivot(0, -0.46, 0), foot = pivot(0, -0.42, 0);
    thigh.add(mesh(new THREE.CapsuleGeometry(0.085, 0.3, 4, 10), pants, 0, -0.23, 0));
    thigh.add(mesh(new THREE.BoxGeometry(0.035, 0.13, 0.12), pants, side * 0.088, -0.24, 0.0));            // cargo pocket
    shin.add(mesh(new THREE.CapsuleGeometry(0.07, 0.28, 4, 10), pants, 0, -0.2, 0));
    shin.add(mesh(new THREE.SphereGeometry(0.078, 12, 8), pants, 0, -0.36, 0, 1, 0.55, 1));               // jogger cuff
    foot.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 0.27), shoe, 0, -0.035, 0.055));
    foot.add(mesh(new THREE.SphereGeometry(0.052, 10, 8), shoe, 0, -0.03, 0.17, 1, 0.8, 1.15));            // toe
    foot.add(mesh(new THREE.BoxGeometry(0.104, 0.018, 0.29), sole, 0, -0.063, 0.06));
    shin.add(foot); thigh.add(shin); body.add(thigh);
    return { thigh, shin };
  });

  // ---- torso (hoodie), neck, head ----
  const torso = pivot(0, 0.95, 0); body.add(torso);
  torso.add(mesh(new THREE.CapsuleGeometry(0.15, 0.36, 4, 14), hoodie, 0, 0.27, 0, 1.25, 1, 0.86));
  torso.add(mesh(new THREE.BoxGeometry(0.26, 0.09, 0.06), hoodie, 0, 0.08, 0.135));                           // kangaroo pocket
  torso.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 6), white, -0.03, 0.46, 0.14), mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 6), white, 0.03, 0.46, 0.14));   // drawstrings
  torso.add(mesh(new THREE.SphereGeometry(0.13, 14, 10), hoodie, 0, 0.56, -0.085, 1.2, 0.8, 0.8));           // hood hanging at the back
  const collar = mesh(new THREE.TorusGeometry(0.085, 0.034, 8, 18), hoodie, 0, 0.56, 0); collar.rotation.x = Math.PI / 2; torso.add(collar);
  torso.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), skin, 0, 0.6, 0));                         // neck
  const head = pivot(0, 0.63, 0); torso.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.118, 24, 18), skin, 0, 0.09, 0, 0.95, 1.06, 1));                   // face
  head.add(mesh(new THREE.SphereGeometry(0.125, 24, 14, 0, Math.PI * 2, 0, 1.2), hair, 0, 0.098, 0, 0.97, 1.06, 1.0));      // hair on top
  head.add(mesh(new THREE.SphereGeometry(0.128, 24, 14, 0, Math.PI * 2, 0, 1.78), hair, 0, 0.1, -0.02, 0.97, 1.06, 1.0));    // hair at the back and sides
  head.add(mesh(new THREE.SphereGeometry(0.07, 14, 10), hair, 0.012, 0.205, 0.07, 1.15, 0.55, 1.2));           // the quiff in front
  [1, -1].forEach((s) => {
    head.add(mesh(new THREE.SphereGeometry(0.0125, 10, 8), dark, s * 0.042, 0.1, 0.108, 1, 1.25, 0.6));       // eyes
    head.add(mesh(new THREE.BoxGeometry(0.05, 0.009, 0.01), dark, s * 0.045, 0.128, 0.108));                  // eyebrows
    head.add(mesh(new THREE.SphereGeometry(0.024, 10, 8), skin, s * 0.108, 0.085, -0.005, 0.5, 1, 0.8));      // ears
  });
  head.add(mesh(new THREE.SphereGeometry(0.016, 10, 8), skin, 0, 0.07, 0.116, 0.9, 1.1, 1));                  // nose
  head.add(mesh(new THREE.BoxGeometry(0.04, 0.007, 0.008), dark, 0, 0.032, 0.108));                           // mouth

  // ---- arms ----
  const arms = [1, -1].map((side) => {
    const sh = pivot(side * 0.215, 0.49, 0), el = pivot(0, -0.29, 0);
    sh.add(mesh(new THREE.CapsuleGeometry(0.056, 0.17, 4, 10), hoodie, 0, -0.145, 0));
    el.add(mesh(new THREE.CapsuleGeometry(0.05, 0.15, 4, 10), hoodie, 0, -0.135, 0));
    el.add(mesh(new THREE.SphereGeometry(0.054, 10, 8), hoodie, 0, -0.255, 0, 1, 0.6, 1));                     // cuff
    el.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), skin, 0, -0.305, 0.005, 0.9, 1.15, 0.9));              // hand
    sh.add(el); torso.add(sh);
    return { sh, el };
  });

  // ---- animation ----
  const P = { tL: 0, kL: 0, tR: 0, kR: 0, aLx: 0, aLz: 0, eL: 0, aRx: 0, aRz: 0, eR: 0, eRz: 0, torX: 0, torY: 0, headX: 0, headY: 0, bodyY: 0, lean: 0 };
  let ph = Math.random() * 6, last = null, prevT = 0;
  const target = (pose, t, speed) => {
    const T = { tL: 0, kL: 0.04, tR: 0, kR: 0.04, aLx: 0, aLz: 0.07, eL: -0.12, aRx: 0, aRz: -0.07, eR: -0.12, eRz: 0, torX: 0.01 + 0.012 * Math.sin(t * 1.8), torY: 0, headX: 0, headY: 0.12 * Math.sin(t * 0.5), bodyY: 0, lean: 0 };
    const s = Math.sin(ph), c = Math.cos(ph);
    if (pose === 'walk' || pose === 'run') {
      const run = pose === 'run', A = run ? 0.95 : 0.52, K = run ? 1.65 : 0.95, B = run ? 0.95 : 0.5;
      T.tL = -A * s; T.tR = A * s; T.kL = 0.06 + K * Math.max(0, c); T.kR = 0.06 + K * Math.max(0, -c);
      T.aLx = B * s; T.aRx = -B * s; T.aLz = 0.05; T.aRz = -0.05;
      T.eL = -((run ? 1.15 : 0.3) + (run ? 0.3 : 0.22) * Math.max(0, -s)); T.eR = -((run ? 1.15 : 0.3) + (run ? 0.3 : 0.22) * Math.max(0, s));
      T.torY = 0.15 * s; T.headY = -0.09 * s; T.torX = run ? 0.12 : 0.04; T.lean = run ? 0.1 : 0.02;
      T.bodyY = -(run ? 0.05 : 0.035) * s * s;
      return T;
    }
    const e = 0.5 + 0.5 * Math.sin(t * 9);
    switch (pose) {
      case 'handsup': T.aLz = 2.6; T.aRz = -2.6; T.eL = -0.2; T.eR = -0.2; break;
      case 'wave': T.aRz = -2.4; T.eR = -0.3; T.eRz = Math.sin(t * 9) * 0.55; break;
      case 'talk': T.aRx = -0.6 + 0.12 * Math.sin(t * 5); T.eR = -1.0 + 0.2 * Math.sin(t * 8); T.headX = 0.05 * Math.sin(t * 5); T.headY = 0.2 * Math.sin(t * 1.3); break;
      case 'punch': T.aRx = -1.5 * e; T.eR = -0.15; T.aLx = -0.9; T.eL = -1.35; T.torY = 0.4 * e; T.torX = 0.12; T.tL = -0.25; T.tR = 0.25; T.kL = 0.3; T.kR = 0.3; break;
      case 'kick': T.tR = -1.35 * e; T.kR = 0.25; T.tL = 0.06; T.torX = -0.2 * e; T.aLz = 0.9; T.aRz = -0.9; break;
      case 'hurt': T.torX = 0.42; T.headX = 0.25; T.aLx = -0.9; T.aRx = -0.9; T.eL = -0.9; T.eR = -0.9; T.bodyY = -0.05; T.kL = 0.3; T.kR = 0.3; T.tL = -0.2; T.tR = -0.2; break;
      case 'dance': { const u = Math.sin(t * 8); T.bodyY = -0.05 + Math.abs(u) * 0.07; T.tL = -0.3 * u; T.tR = 0.3 * u; T.kL = 0.4 + 0.3 * u; T.kR = 0.4 - 0.3 * u; T.torY = 0.35 * Math.sin(t * 4); T.aLz = 1.7 + 0.5 * Math.sin(t * 8); T.aRz = -1.7 - 0.5 * Math.sin(t * 8 + 1); T.eL = -0.4; T.eR = -0.4; break; }
      case 'pray': T.bodyY = -0.42; T.tL = -1.45; T.tR = -1.45; T.kL = 1.6; T.kR = 1.6; T.torX = 0.4; T.headX = 0.3; T.aLx = -0.9; T.aRx = -0.9; T.eL = -1.3; T.eR = -1.3; break;
      default: break;
    }
    return T;
  };
  return {
    kind: 'hero', root, mesh: body, group, models3d: true,
    update(pose, speed, t) {
      const dt = last === null ? 0.016 : Math.min(0.1, Math.max(0, t - last)); last = t; prevT = t;
      const moving = pose === 'walk' || pose === 'run';
      if (moving) ph += dt * (pose === 'run' ? 12 : 6.4 * Math.max(0.8, Math.min(1.5, (speed || 1.2) / 1.2)));
      const T = target(pose, t, speed), k = 1 - Math.exp(-dt * (moving ? 14 : 9));
      for (const key in P) P[key] += (T[key] - P[key]) * k;
      legs[0].thigh.rotation.x = P.tL; legs[0].shin.rotation.x = P.kL; legs[1].thigh.rotation.x = P.tR; legs[1].shin.rotation.x = P.kR;
      arms[0].sh.rotation.x = P.aLx; arms[0].sh.rotation.z = P.aLz; arms[0].el.rotation.x = P.eL;
      arms[1].sh.rotation.x = P.aRx; arms[1].sh.rotation.z = P.aRz; arms[1].el.rotation.x = P.eR; arms[1].el.rotation.z = P.eRz;
      torso.rotation.x = P.torX; torso.rotation.y = P.torY; head.rotation.x = P.headX; head.rotation.y = P.headY;
      body.position.y = P.bodyY + 0.025; body.rotation.x = P.lean;
    },
    dispose() { group.remove(root); geos.forEach((g) => { if (g !== shadowGeo) g.dispose(); }); mats.forEach((m) => m.dispose()); },
  };
}
