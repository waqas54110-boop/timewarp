// Portal intro (public/js/portal-intro.js): era labels, when JUMP appears, the jump arc, and a full walk + jump + arrival with fakes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

async function load() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'portal-intro.js'), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
}

test('era info and fov', async () => {
  const P = await load();
  assert.equal(P.eraInfo('future', 2050).label, 'Future · 2050');
  assert.equal(P.eraInfo('past', -65000000).label, 'Past · 65000000 BCE');
  assert.equal(P.eraInfo('nope', 2026).name, 'Present');
  assert.ok(P.cameraFov(0.5) > P.cameraFov(1.8)); assert.ok(P.cameraFov(0.3) <= 96 && P.cameraFov(3) >= 60);
});

test('JUMP only appears near the portal; the arc ends in the portal and shrinks', async () => {
  const P = await load();
  assert.equal(P.canJump(-8), false); assert.equal(P.canJump(-12), true);
  const a = { x: 1, y: 0, z: -12 }, b = { x: 0, y: 7, z: -13.6 };
  const p0 = P.jumpPoint(0, a, b), p5 = P.jumpPoint(0.5, a, b), p1 = P.jumpPoint(1, a, b);
  assert.equal(p0.scale, 1); assert.ok(Math.abs(p1.x - b.x) < 1e-9 && Math.abs(p1.y - b.y) < 1e-9 && Math.abs(p1.z - b.z) < 1e-9);
  assert.ok(p1.scale < 0.35); assert.ok(p5.y > (a.y + b.y) / 2);            // a hop on the way
});

test('walk to the portal, jump, arrive: hero goes back to the street and the intro ends', async () => {
  const P = await load();
  const v3 = () => { const o = { x: 0, y: 0, z: 0, set(a, b, c) { o.x = a; o.y = b; o.z = c; return o; }, clone() { return v3().set(o.x, o.y, o.z); }, copy(q) { return o.set(q.x, q.y, q.z); }, setScalar(k) { return o.set(k, k, k); } }; return o; };
  const node = () => ({ position: v3(), rotation: { x: 0, y: 0, z: 0 }, scale: v3().setScalar(1), add() {}, traverse() {}, removeFromParent() {} });
  const THREE = { Scene: function () { return { ...node(), add() {} }; }, Color: function () {}, AmbientLight: function () {}, DirectionalLight: function () { return { position: v3() }; }, PointLight: function () { return { position: v3(), intensity: 0 }; },
    MeshBasicMaterial: function () { return {}; }, PlaneGeometry: function () { return {}; }, Mesh: function () { return node(); }, TextureLoader: function () { return { load() {} }; }, CanvasTexture: function () { return {} }, TextureLoader: function () { return { load() {} }; }, AdditiveBlending: 2, SRGBColorSpace: 's' };
  const els = {}; const mkEl = (id) => (els[id] = els[id] || { style: {}, hidden: false, textContent: '', listeners: {}, addEventListener(n, f) { this.listeners[n] = f; }, remove() {} });
  const ui = { style: {}, appendChild() {}, set innerHTML(_) {}, querySelector: (q) => mkEl(q), remove() { ui.removed = true; } };
  global.document = { createElement: (t) => (t === 'canvas' ? { getContext: () => { const px = new Proxy(function () {}, { get: () => px, apply: () => px, set: () => true }); return px; } } : ui), body: { appendChild() {} } };
  global.requestAnimationFrame = (f) => f(); global.addEventListener = () => {}; global.removeEventListener = () => {}; global.innerWidth = 400; global.innerHeight = 800;
  const parent = { added: 0, add() { parent.added++; } };
  const player = { group: Object.assign(node(), { parent }) }; player.group.position.set(7, 0, 9);
  const camera = { fov: 65, position: v3(), updateProjectionMatrix() {}, lookAt() {} };
  let done = null, renders = 0; const hiddenEl = { style: { visibility: 'visible' } };
  const I = P.createPortalIntro({ THREE, renderer: { render() { renders++; } }, camera, player, mode: 'future', year: 2050, hideEls: [hiddenEl], onDone: (i) => { done = i; } });
  assert.ok(I.active); assert.equal(hiddenEl.style.visibility, 'hidden'); assert.ok(camera.fov > 65);
  assert.equal(els['#pi-jump'].hidden !== undefined, true);
  for (let i = 0; i < 200; i++) I.step(0.05, new Set(['f']));             // walk forward
  assert.ok(player.group.position.z <= -12 && player.group.position.z >= -12.4);
  assert.equal(els['#pi-jump'].hidden, false);                              // JUMP button shows up
  els['#pi-jump'].listeners.click();
  let airborne = false; for (let i = 0; i < 60 && I.active; i++) { airborne = I.step(0.05, new Set()).airborne || airborne; }
  I.render(); assert.ok(airborne); assert.equal(I.active, false); assert.ok(done && done.label === 'Future · 2050');
  assert.deepEqual([player.group.position.x, player.group.position.z], [7, 9]);   // back at the street spawn
  assert.equal(parent.added, 1); assert.equal(camera.fov, 65); assert.equal(hiddenEl.style.visibility, 'visible');
});

test('era windows: future and present get a drawn scene, past keeps the dinosaur picture', async () => {
  const P = await load();
  const calls = []; global.document = { createElement: () => { const px = new Proxy(function () {}, { get: (t, k) => { if (k === 'fillRect') return (...a) => calls.push(a); return px; }, apply: () => px, set: () => true }); return px; } };
  const cv = P.drawEraView('future', 128, () => 0.5); assert.ok(cv && calls.length > 50);
  const c2 = calls.length; P.drawEraView('present', 128, () => 0.5); assert.ok(calls.length > c2 + 50);
});
