// Portal intro: after Past / Present / Future is chosen, the player starts inside the time-lab.
// Walk to the glowing portal, press JUMP, fly through it and the world of that era begins.
// The lab picture is public/media/world-portal-lab.jpg; the hero is the real 3D player of the game.

export const ERAS = {
  past:    { name: 'Past',    tint: 0xffd9a0, glow: 0xffb04a, hint: 'Portal ke andar purani duniya hai' },
  present: { name: 'Present', tint: 0xffffff, glow: 0x8fd3ff, hint: 'Portal ke andar aaj ki duniya hai' },
  future:  { name: 'Future',  tint: 0xd9c8ff, glow: 0xa77bff, hint: 'Portal ke andar aane wali duniya hai' },
};

// pure helpers (tested in tests/portal-intro.test.js)
export function eraInfo(mode, year) {
  const e = ERAS[mode] || ERAS.present;
  return { ...e, label: `${e.name} · ${year < 0 ? -year + ' BCE' : year}` };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const canJump = (z) => z <= -9.2;
// jump arc: p = 0..1 from the start point to the portal centre, with a hop on the way
export function jumpPoint(p, from, to, hop = 1.6) {
  const k = clamp(p, 0, 1), e = k * k * (3 - 2 * k);
  return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e + Math.sin(Math.PI * k) * hop, z: from.z + (to.z - from.z) * e, scale: 1 - 0.7 * e };
}
export function cameraFov(aspect) { return clamp(2 * Math.atan(Math.tan(0.61) / Math.min(1, aspect * 1.15)) * 180 / Math.PI, 60, 96); }

const PLANE_Z = -14, PLANE_S = 16, PLANE_Y = 2.9;          // lab picture: size, depth and height in the intro scene
const PORTAL = { x: 0, y: PLANE_Y + PLANE_S / 2 - PLANE_S * 0.40, z: PLANE_Z + 0.4 };   // portal centre is at 50% / 40% of the picture
const START_Z = -6, STOP_Z = -10.6;

export function createPortalIntro({ THREE, renderer, camera, player, mode, year, hideEls = [], onDone }) {
  const info = eraInfo(mode, year);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const sunL = new THREE.DirectionalLight(0xffffff, 1.2); sunL.position.set(2, 8, 6); scene.add(sunL);

  // the lab picture (falls back to a dark wall if the file is missing)
  const planeMat = new THREE.MeshBasicMaterial({ color: info.tint });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_S, PLANE_S), planeMat);
  plane.position.set(0, PLANE_Y, PLANE_Z); scene.add(plane);
  new THREE.TextureLoader().load('/media/world-portal-lab.jpg', (tex) => { tex.colorSpace = THREE.SRGBColorSpace; planeMat.map = tex; planeMat.needsUpdate = true; }, undefined, () => { /* keep the dark wall */ });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshBasicMaterial({ color: 0x1a2236 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.02, -6); scene.add(floor);

  // era-coloured swirl in front of the portal
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'), glow = '#' + info.glow.toString(16).padStart(6, '0');
  for (let i = 0; i < 9; i++) { g.save(); g.translate(128, 128); g.rotate(i * 0.7); g.scale(1, 0.55 + (i % 3) * 0.14); g.strokeStyle = glow; g.globalAlpha = 0.55; g.lineWidth = 2 + (i % 3); g.beginPath(); g.arc(0, 0, 100 - i * 4, 0, Math.PI * 1.55); g.stroke(); g.restore(); }
  const swirlTex = new THREE.CanvasTexture(cv);
  const swirl = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_S * 0.62, PLANE_S * 0.62), new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  swirl.position.set(PORTAL.x, PORTAL.y, PLANE_Z + 0.05); scene.add(swirl);
  const light = new THREE.PointLight(info.glow, 40, 18); light.position.set(0, PORTAL.y, PLANE_Z + 2); scene.add(light);

  // overlay: title, hint, JUMP and Skip buttons, white flash
  const ui = document.createElement('div');
  ui.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none;font-family:system-ui,sans-serif;color:#fff';
  ui.innerHTML = `<div style="position:absolute;top:max(14px,env(safe-area-inset-top));left:0;right:0;text-align:center;text-shadow:0 2px 8px #000">
      <div style="font-size:12px;letter-spacing:.2em;opacity:.8">TIME LAB</div><div id="pi-title" style="font-size:22px;font-weight:700"></div>
      <div id="pi-hint" style="font-size:14px;margin-top:6px;opacity:.9"></div></div>
    <button id="pi-skip" style="pointer-events:auto;position:absolute;top:max(14px,env(safe-area-inset-top));right:12px;background:#0008;color:#fff;border:1px solid #fff5;border-radius:18px;padding:6px 14px">Skip</button>
    <button id="pi-jump" hidden style="pointer-events:auto;position:absolute;left:50%;bottom:22%;transform:translateX(-50%);padding:16px 38px;font-size:20px;font-weight:800;border:0;border-radius:32px;color:#001;background:linear-gradient(#fff,#bfe7ff);box-shadow:0 0 28px #8fd3ff">JUMP ▲</button>
    <div id="pi-flash" style="position:absolute;inset:0;background:#fff;opacity:0"></div>`;
  document.body.appendChild(ui);
  const $ = (id) => ui.querySelector('#' + id);
  $('pi-title').textContent = info.label; $('pi-hint').textContent = 'Aage chalo (pad / W) aur portal ke paas JUMP dabao';
  const hidden = hideEls.filter(Boolean).map((el) => [el, el.style.visibility]); hidden.forEach(([el]) => { el.style.visibility = 'hidden'; });

  const saved = { fov: camera.fov, parent: player.group.parent, pos: player.group.position.clone(), rotY: player.group.rotation.y, scale: player.group.scale.clone() };
  scene.add(player.group);                                   // the hero stands in the lab while the intro runs
  const hp = player.group.position; hp.set(0, 0, START_Z); player.group.rotation.y = Math.PI; player.group.scale.setScalar(1);
  camera.fov = cameraFov(innerWidth / innerHeight); camera.updateProjectionMatrix();

  const S = { active: true, jumping: false, p: 0, from: null, flash: 0, t: 0, finishing: false };
  let jumpHeld = false;
  const startJump = () => { if (S.jumping || !canJump(hp.z)) return; S.jumping = true; S.p = 0; S.from = { x: hp.x, y: hp.y, z: hp.z }; };
  $('pi-jump').addEventListener('click', startJump);
  $('pi-skip').addEventListener('click', () => finish());
  const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!jumpHeld) { jumpHeld = true; startJump(); } } };
  const onKeyUp = (e) => { if (e.code === 'Space' || e.code === 'Enter') jumpHeld = false; };
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp);

  function finish() {
    if (S.finishing) return; S.finishing = true; S.active = false;
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp);
    if (saved.parent) saved.parent.add(player.group); else player.group.removeFromParent();
    player.group.position.copy(saved.pos); player.group.rotation.y = saved.rotY; player.group.scale.copy(saved.scale);
    camera.fov = saved.fov; camera.updateProjectionMatrix();
    hidden.forEach(([el, v]) => { el.style.visibility = v; });
    const fl = $('pi-flash'); fl.style.opacity = '1'; fl.style.transition = 'opacity 1.1s ease-out';
    $('pi-jump').hidden = true; $('pi-skip').hidden = true; $('pi-title').textContent = info.label; $('pi-hint').textContent = 'Aap naye daur mein pohanch gaye!';
    requestAnimationFrame(() => requestAnimationFrame(() => { fl.style.opacity = '0'; }));
    setTimeout(() => ui.remove(), 1600);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    if (onDone) onDone(info);
  }

  // one frame: dirs = Set of 'f','b','l','r','run' ; returns what the hero is doing so world.js can pose the body
  S.step = (dt, dirs) => {
    S.t += dt; swirl.rotation.z -= dt * 0.9; light.intensity = 36 + Math.sin(S.t * 3) * 8;
    let moving = false, run = false;
    if (!S.jumping) {
      const f = (dirs.has('f') ? 1 : 0) - (dirs.has('b') ? 1 : 0), s = (dirs.has('r') ? 1 : 0) - (dirs.has('l') ? 1 : 0);
      run = dirs.has('run'); const sp = (run ? 5 : 2.8) * dt;
      if (f || s) { moving = true; hp.z = clamp(hp.z - f * sp, STOP_Z, -4); hp.x = clamp(hp.x + s * sp, -3.2, 3.2); }
      $('pi-jump').hidden = !canJump(hp.z);
      if (canJump(hp.z)) $('pi-hint').textContent = 'JUMP dabao aur portal mein kood jao!';
      player.group.rotation.y = Math.PI;
    } else {
      S.p += dt / 1.5; const q = jumpPoint(S.p, S.from, PORTAL);
      hp.set(q.x, q.y, q.z); player.group.scale.setScalar(q.scale); $('pi-jump').hidden = true;
      if (S.p > 0.72) { S.flash = clamp((S.p - 0.72) / 0.28, 0, 1); $('pi-flash').style.opacity = String(S.flash); }
      if (S.p >= 1) finish();
    }
    // camera follows behind the hero and keeps the portal in view
    const cx = hp.x * 0.5, cz = (S.jumping ? S.from.z : hp.z) + 5;
    camera.position.set(cx, 1.8 + (S.jumping ? S.p * 1.4 : 0), cz);
    camera.lookAt(hp.x * 0.3, 3.0 + (S.jumping ? S.p * 1.5 : 0), PLANE_Z);
    return { moving, run, jumping: S.jumping, airborne: S.jumping };
  };
  S.render = () => renderer.render(scene, camera);
  S.info = info;
  return S;
}
