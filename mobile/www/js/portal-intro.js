// Portal intro: after Past / Present / Future is chosen, the player starts inside the time-lab.
// Walk to the glowing portal, press JUMP, fly through it and the world of that era begins.
// The lab picture is public/media/world-portal-lab.jpg; the hero is the real 3D player of the game.

export const ERAS = {
  past:    { name: 'Past',    tint: 0xffeccf, glow: 0xffb04a, hint: 'Portal ke andar purani duniya hai' },
  present: { name: 'Present', tint: 0xffffff, glow: 0x8fd3ff, hint: 'Portal ke andar aaj ki duniya hai' },
  future:  { name: 'Future',  tint: 0xe4dbff, glow: 0xa77bff, hint: 'Portal ke andar aane wali duniya hai' },
};

// pure helpers (tested in tests/portal-intro.test.js)
export function eraInfo(mode, year) {
  const e = ERAS[mode] || ERAS.present;
  return { ...e, label: `${e.name} · ${year < 0 ? -year + ' BCE' : year}` };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const canJump = (z) => z <= -11.4;
// jump arc: p = 0..1 from the start point to the portal centre, with a hop on the way
export function jumpPoint(p, from, to, hop = 1.6) {
  const k = clamp(p, 0, 1), e = k * k * (3 - 2 * k);
  return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e + Math.sin(Math.PI * k) * hop, z: from.z + (to.z - from.z) * e, scale: 1 - 0.7 * e };
}
export function cameraFov(aspect) { return clamp(2 * Math.atan(Math.tan(0.61) / Math.min(1, aspect * 1.15)) * 180 / Math.PI, 60, 96); }


// ---------- what you see INSIDE the portal, per era ----------
// past = the dinosaur valley that is already in the lab picture (nothing is drawn over it)
// present = a busy street, future = neon towers with flying cars. Drop your own pictures at
// public/media/world-portal-view-present.jpg / -future.jpg (also -past.jpg) and they replace the drawn scenes.
export function drawEraView(mode, n = 512, rand = Math.random) {
  const cv = document.createElement('canvas'); cv.width = cv.height = n;
  const g = cv.getContext('2d'), R = (a, b) => a + rand() * (b - a), grad = (y0, y1, stops) => { const l = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => l.addColorStop(o, c)); return l; };
  const car = (x, y, w, c, fly) => {
    const h = w * 0.34; g.fillStyle = c; g.beginPath(); g.roundRect(x, y - h, w, h, h * 0.45); g.fill();
    g.fillStyle = fly ? '#bff3ff' : '#cfe8ff'; g.beginPath(); g.roundRect(x + w * 0.22, y - h * 1.05, w * 0.5, h * 0.55, h * 0.3); g.fill();
    if (fly) { g.fillStyle = '#22d3eeaa'; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.18, w * 0.5, h * 0.22, 0, 0, 6.3); g.fill(); g.fillStyle = '#fff'; g.fillRect(x + w * 0.9, y - h * 0.6, w * 0.08, h * 0.2); }
    else { g.fillStyle = '#111'; [0.2, 0.75].forEach((k) => { g.beginPath(); g.arc(x + w * k, y, h * 0.3, 0, 6.3); g.fill(); }); }
  };
  if (mode === 'future') {
    g.fillStyle = grad(0, n, [[0, '#1b0b4a'], [0.45, '#6a2fb5'], [0.75, '#ff7ac8'], [1, '#ffd0a8']]); g.fillRect(0, 0, n, n);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${R(0.3, 0.9)})`; g.fillRect(R(0, n), R(0, n * 0.45), 2, 2); }
    g.fillStyle = '#e8e4ff'; g.beginPath(); g.arc(n * 0.78, n * 0.2, n * 0.07, 0, 6.3); g.fill(); g.fillStyle = '#c9b8ff'; g.beginPath(); g.arc(n * 0.2, n * 0.3, n * 0.035, 0, 6.3); g.fill();
    for (let layer = 0; layer < 3; layer++) {                                   // three rows of glass towers, far to near
      const col = ['#3a2a8a', '#2a1d6b', '#150f45'][layer], neon = ['#67e8f9', '#f0abfc', '#22d3ee'][layer];
      for (let x = -10; x < n; x += R(26, 46) - layer * 4) {
        const w = R(28, 52) + layer * 10, h = R(n * 0.25, n * 0.62) * (1 - layer * 0.12), top = n * 0.82 - h;
        g.fillStyle = col; g.fillRect(x, top, w, n); g.fillStyle = neon; g.fillRect(x, top, w, 3); g.fillRect(x + w - 2, top, 2, h);
        g.fillStyle = neon + '99'; for (let y = top + 10; y < n * 0.8; y += 14) for (let xx = x + 5; xx < x + w - 6; xx += 10) if (rand() < 0.45) g.fillRect(xx, y, 4, 6);
        if (rand() < 0.4) { g.fillStyle = neon; g.fillRect(x + w / 2 - 1, top - 22, 2, 22); }
      }
    }
    g.fillStyle = grad(n * 0.8, n, [[0, '#1a1450'], [1, '#07051f']]); g.fillRect(0, n * 0.8, n, n * 0.2);
    for (const [y, sz, c] of [[n * 0.3, 70, '#f43f5e'], [n * 0.44, 96, '#22d3ee'], [n * 0.58, 120, '#facc15'], [n * 0.7, 80, '#a78bfa'], [n * 0.36, 52, '#34d399']]) car(R(0.05, 0.7) * n, y, sz, c, true);   // flying cars
    g.strokeStyle = '#67e8f988'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, n * (0.28 + i * 0.13)); g.lineTo(n, n * (0.26 + i * 0.13)); g.stroke(); }   // air lanes
  } else {
    g.fillStyle = grad(0, n * 0.7, [[0, '#4aa3ff'], [1, '#d6ecff']]); g.fillRect(0, 0, n, n);
    g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { g.globalAlpha = 0.85; g.beginPath(); g.ellipse(R(0, n), R(20, n * 0.3), R(40, 80), R(12, 22), 0, 0, 6.3); g.fill(); } g.globalAlpha = 1;
    for (let layer = 0; layer < 2; layer++) for (let x = -10; x < n; x += R(40, 70)) {
      const w = R(44, 76), h = R(n * 0.2, n * 0.5) * (1 - layer * 0.3), top = n * 0.7 - h;
      g.fillStyle = layer ? '#9fb2c8' : ['#8d99ab', '#a3a7ad', '#7f8ea3'][Math.floor(R(0, 3))]; g.fillRect(x, top, w, n);
      g.fillStyle = '#dff1ff'; for (let y = top + 8; y < n * 0.68; y += 13) for (let xx = x + 6; xx < x + w - 8; xx += 11) g.fillRect(xx, y, 5, 7);
    }
    g.fillStyle = '#2e3138'; g.fillRect(0, n * 0.7, n, n * 0.3); g.fillStyle = '#9aa0a8'; g.fillRect(0, n * 0.68, n, n * 0.03);
    g.fillStyle = '#e8e8e8'; for (let x = 0; x < n; x += 70) g.fillRect(x, n * 0.86, 38, 4);
    [['#ef4444', 0.06, 0.8], ['#3b82f6', 0.4, 0.78], ['#facc15', 0.68, 0.84], ['#22c55e', 0.22, 0.93], ['#f5f5f5', 0.6, 0.95]].forEach(([c, x, y]) => car(x * n, y * n, n * (0.17 + (y - 0.78) * 0.5), c, false));
    g.fillStyle = '#ffd34d'; g.fillRect(n * 0.84, n * 0.8, n * 0.15, n * 0.07);   // a bus
  }
  const m = g.createRadialGradient(n / 2, n / 2, n * 0.34, n / 2, n / 2, n * 0.5);     // soft round edge so it melts into the portal ring
  m.addColorStop(0, '#000f'); m.addColorStop(1, '#0000'); g.globalCompositeOperation = 'destination-in'; g.fillStyle = m; g.fillRect(0, 0, n, n); g.globalCompositeOperation = 'source-over';
  return cv;
}

const PLANE_Z = -14, PLANE_S = 16, PLANE_Y = 4.36;          // lab picture: size, depth and height in the intro scene
const PORTAL = { x: 0, y: PLANE_Y + PLANE_S / 2 - PLANE_S * 0.445, z: PLANE_Z + 0.4 };   // portal centre is at 50% / 44.5% of the picture
const START_Z = -8.5, STOP_Z = -12.4;

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

  // the world inside the portal: past = the dinosaur valley already in the picture; present / future = drawn here (or your own jpg)
  const WIN_W = PLANE_S * 0.425, WIN_H = PLANE_S * 0.40, winMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  if (mode !== 'past') {
    winMat.map = new THREE.CanvasTexture(drawEraView(mode === 'future' ? 'future' : 'present', 512));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), winMat); win.position.set(PORTAL.x, PORTAL.y, PLANE_Z + 0.03); scene.add(win);
    new THREE.TextureLoader().load(`/media/world-portal-view-${mode}.jpg`, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; winMat.map = tex; winMat.needsUpdate = true; }, undefined, () => { /* keep the drawn scene */ });
  }
  // era-coloured swirl in front of the portal
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'), glow = '#' + info.glow.toString(16).padStart(6, '0');
  for (let i = 0; i < 9; i++) { g.save(); g.translate(128, 128); g.rotate(i * 0.7); g.scale(1, 0.55 + (i % 3) * 0.14); g.strokeStyle = glow; g.globalAlpha = 0.32; g.lineWidth = 2 + (i % 3); g.beginPath(); g.arc(0, 0, 100 - i * 4, 0, Math.PI * 1.55); g.stroke(); g.restore(); }
  const swirlTex = new THREE.CanvasTexture(cv);
  const swirl = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_S * 0.5, PLANE_S * 0.5), new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  swirl.position.set(PORTAL.x, PORTAL.y, PLANE_Z + 0.05); scene.add(swirl);
  const light = new THREE.PointLight(info.glow, 40, 18); light.position.set(0, PORTAL.y, PLANE_Z + 2); scene.add(light);

  // overlay: title, hint, JUMP and Skip buttons, white flash
  const ui = document.createElement('div');
  ui.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none;font-family:system-ui,sans-serif;color:#fff';
  ui.innerHTML = `<div style="position:absolute;top:max(14px,env(safe-area-inset-top));left:0;right:0;text-align:center;text-shadow:0 2px 8px #000">
      <div style="font-size:12px;letter-spacing:.2em;opacity:.8">TIME LAB</div><div id="pi-title" style="font-size:22px;font-weight:700"></div>
      <div id="pi-hint" style="font-size:14px;margin-top:6px;opacity:.9"></div></div>
    <button id="pi-skip" style="pointer-events:auto;position:absolute;top:max(14px,env(safe-area-inset-top));right:12px;background:#0008;color:#fff;border:1px solid #fff5;border-radius:18px;padding:6px 14px">Skip</button>
    <button id="pi-jump" hidden style="pointer-events:auto;position:absolute;left:50%;bottom:7%;transform:translateX(-50%);padding:16px 38px;font-size:20px;font-weight:800;border:0;border-radius:32px;color:#001;background:linear-gradient(#fff,#bfe7ff);box-shadow:0 0 28px #8fd3ff">JUMP ▲</button>
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
      if (f || s) { moving = true; hp.z = clamp(hp.z - f * sp, STOP_Z, -6); hp.x = clamp(hp.x + s * sp, -3.2, 3.2); }
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
    camera.position.set(cx, 1.8 + (S.jumping ? S.p * 0.6 : 0), cz);
    camera.lookAt(hp.x * 0.3, 3.4 + (S.jumping ? S.p * 1.2 : 0), PLANE_Z);
    return { moving, run, jumping: S.jumping, airborne: S.jumping };
  };
  S.render = () => renderer.render(scene, camera);
  S.info = info;
  return S;
}
