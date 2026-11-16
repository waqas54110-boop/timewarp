import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.window = { TimeWarpSprites: require('../../public/js/sprite-data.js') };
const THREE = await import('/vendor/three/three.module.js');
const S = await import('/js/sprites.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cam = { getWorldDirection(v) { v.x = 0; v.y = 0; v.z = -1; return v; }, getWorldPosition(v) { v.x = 0; v.y = 2; v.z = 10; return v; } };   // camera behind the person, looking toward -z
S.beginFrame(cam);
const COLS = 6, rowsOf = (n) => Math.ceil(n / COLS);
const g = new THREE.Group(), a = S.createPerson('male', g); await sleep(10);
const u = () => a.mesh.geometry.attributes.uv;
const col = () => Math.round(Math.min(u().getX(0), u().getX(1)) * COLS);
const flipped = () => u().getX(0) > u().getX(1);
const frameName = () => { const names = S.FRAMES.male; const uu = Math.min(u().getX(0), u().getX(1)), vv = Math.max(u().a[1], u().a[7]); return names[(rowsOf(names.length) - Math.round(vv * rowsOf(names.length))) * COLS + Math.round(uu * COLS)]; };

g.rotation.y = Math.PI; a.update('idle', 0, 0);                  // walking away from the camera: standing still shows the BACK
assert.strictEqual(frameName(), 'back');
const seen = new Set(); for (let t = 0; t < 2; t += 0.05) { a.update('walk', 1.2, t); seen.add(frameName()); }
assert.ok(seen.has('turn') && seen.has('back'), 'walking away uses the from-behind frames');
g.rotation.y = Math.PI / 2; a.update('walk', 1.2, 0.2); assert.strictEqual(flipped(), false, 'moving right on screen: picture as it is');
g.rotation.y = -Math.PI / 2; a.update('walk', 1.2, 0.2); assert.strictEqual(flipped(), true, 'moving left: mirrored');
const side = new Set(); for (let t = 0; t < 3; t += 0.05) { a.update('run', 3, t); side.add(frameName()); }
assert.ok(['run1', 'run2', 'run3'].every((f) => side.has(f)), 'run cycles through all run poses');
g.rotation.y = 0; a.update('walk', 1, 0.1);
assert.ok(Math.abs(a.mesh.rotation.y) < 1e-9, 'the figure faces the camera');

for (const k of ['male', 'female', 'police']) {                  // every pose of every person works from every angle
  const gg = new THREE.Group(), x = S.createPerson(k, gg); await sleep(5);
  for (const pose of ['idle', 'walk', 'run', 'punch', 'kick', 'handsup', 'talk', 'wave', 'dance', 'pray', 'hurt']) for (let i = 0; i < 12; i++) { gg.rotation.y = i * 0.55; x.update(pose, 1.5, i * 0.37); }
}
const v = S.createBillboard('taxi', 4.7); await sleep(10);
v.rotation.y = 0; S.updateBillboards(); assert.ok(v.userData.billboard.mesh.scale.x < 0, 'a car driving right is mirrored');
v.rotation.y = Math.PI; S.updateBillboards(); assert.ok(v.userData.billboard.mesh.scale.x > 0, 'a car driving left is not');
assert.ok(v.userData.billboard.mesh.scale.y > 0 && v.userData.billboard.mesh.scale.y < v.userData.billboard.mesh.scale.x, 'the picture keeps its shape');
S.setTint(new THREE.Color(0.8, 0.9, 1), 0.5); S.unregister(v);
console.log('sprites-run ok');
