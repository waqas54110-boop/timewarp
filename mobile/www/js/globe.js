import * as THREE from '/vendor/three/three.module.js';

const page = document.getElementById('globe-page');
const canvas = document.getElementById('globe-canvas');
const statusEl = document.getElementById('globe-status');
const range = document.getElementById('year-range');
const label = document.getElementById('year-label');
const winSel = document.getElementById('window-select');
const list = document.getElementById('globe-list');
const spinBtn = document.getElementById('globe-spin');
const nowYear = Number(page.dataset.now);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fy = (y) => (y < 0 ? `${-y} BCE` : y < 1000 ? `${y} CE` : String(y));
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); kids.forEach((k) => n.append(k)); return n; };

let events = [];
let selectedDest = null;

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}

// ---------- data ----------
function visibleEvents() {
  const y = Number(range.value), w = winSel.value === 'all' ? Infinity : Number(winSel.value);
  return events.filter((e) => Math.abs(e.event_year - y) <= w);
}
function byDestination(evs) {
  const m = new Map();
  evs.forEach((e) => { if (!m.has(e.destination_id)) m.set(e.destination_id, { id: e.destination_id, name: e.destination_name, country: e.country, lat: e.latitude, lng: e.longitude, events: [] }); m.get(e.destination_id).events.push(e); });
  return [...m.values()];
}
const travelHref = (e) => `/travel?mode=${e.event_year < nowYear ? 'past' : 'present'}&year=${e.event_year}&destinationId=${e.destination_id}`;

function renderList() {
  const groups = byDestination(visibleEvents());
  label.textContent = fy(Number(range.value));
  list.replaceChildren();
  if (!groups.length) { list.append(el('p', { className: 'empty', textContent: 'No located events in this range. Move the slider or widen the range.' })); }
  groups.forEach((g) => {
    const open = selectedDest === g.id;
    const head = el('button', { type: 'button', className: 'globe-dest' + (open ? ' active' : ''), textContent: `${g.name}, ${g.country || ''} (${g.events.length})` });
    head.setAttribute('aria-expanded', String(open));
    head.addEventListener('click', () => select(g.id, true));
    list.append(head);
    if (open) {
      const ul = el('ul', { className: 'globe-events' });
      g.events.forEach((e) => ul.append(el('li', {}, el('span', { className: 'year', textContent: fy(e.event_year) + ' ' }), el('a', { href: travelHref(e), textContent: e.title }))));
      list.append(ul);
    }
  });
  statusEl.textContent = `${groups.length} place(s), ${visibleEvents().length} event(s) near ${fy(Number(range.value))}`;
  drawPins(groups);
}

// ---------- 3D ----------
let renderer, scene, camera, globe, globeMesh, pinsGroup, raycaster, pinMeshes = [];
let targetRot = null, spinning = !reduce, velY = 0, drag = null, raf = 0;
const pinGeo = new THREE.SphereGeometry(0.03, 12, 12);
const matCache = new Map();
const pinMat = (hex) => { if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshBasicMaterial({ color: hex })); return matCache.get(hex); };

const toVec = (lat, lng, r) => {
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

function build() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 3.4;
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(3, 2, 4); scene.add(sun);

  globe = new THREE.Group(); scene.add(globe);
  const sphereMat = new THREE.MeshPhongMaterial({ color: 0x0b1a4a, emissive: 0x050a22, shininess: 12 });
  globeMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), sphereMat);
  globe.add(globeMesh);
  // Optional real texture: drop an equirectangular image at public/media/earth.jpg
  new THREE.TextureLoader().load('/media/earth.jpg', (tex) => { tex.colorSpace = THREE.SRGBColorSpace; sphereMat.map = tex; sphereMat.color.set(0xffffff); sphereMat.emissive.set(0x000000); sphereMat.needsUpdate = true; }, undefined, () => {});

  // graticule every 15 degrees
  const pts = [];
  for (let lat = -75; lat <= 75; lat += 15) for (let lng = -180; lng < 180; lng += 4) { pts.push(toVec(lat, lng, 1.003), toVec(lat, lng + 4, 1.003)); }
  for (let lng = -180; lng < 180; lng += 15) for (let lat = -88; lat < 88; lat += 4) { pts.push(toVec(lat, lng, 1.003), toVec(lat + 4, lng, 1.003)); }
  globe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2b3f8f, transparent: true, opacity: 0.55 })));
  // atmosphere
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 48, 32), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.1, side: THREE.BackSide })));
  // stars
  const sp = []; for (let i = 0; i < 500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(20 + Math.random() * 20); sp.push(v); }
  scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(sp), new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, sizeAttenuation: true })));

  pinsGroup = new THREE.Group(); globe.add(pinsGroup);
  raycaster = new THREE.Raycaster();
  globe.rotation.y = -1.2; globe.rotation.x = 0.35;

  const resize = () => {
    const r = canvas.parentElement.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize); resize();

  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: 0 }; targetRot = null; });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    globe.rotation.y += dx * 0.005; velY = dx * 0.005;
    globe.rotation.x = Math.max(-1.2, Math.min(1.2, globe.rotation.x + dy * 0.005));
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasClick = drag && drag.moved < 5; drag = null;
    if (wasClick) pick(e);
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); camera.position.z = Math.max(1.8, Math.min(5, camera.position.z + e.deltaY * 0.002)); }, { passive: false });

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    if (targetRot) {
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      globe.rotation.y += wrap(targetRot.y - globe.rotation.y) * 0.1;
      globe.rotation.x += (targetRot.x - globe.rotation.x) * 0.1;
    } else if (!drag) {
      if (spinning && selectedDest === null) globe.rotation.y += 0.0015;
      globe.rotation.y += velY; velY *= 0.92;
    }
    renderer.render(scene, camera);
  };
  loop();
  window.addEventListener('pagehide', () => { cancelAnimationFrame(raf); renderer.dispose(); });
}

function drawPins(groups) {
  if (!pinsGroup) return;
  pinsGroup.children.forEach((c) => { if (c.userData.ring) { c.geometry.dispose(); c.material.dispose(); } });
  pinsGroup.clear(); pinMeshes = [];
  groups.forEach((g) => {
    const hex = g.id === selectedDest ? 0xffffff : g.events.some((e) => e.event_year >= 1800) ? 0x22d3ee : 0xffb347;
    const m = new THREE.Mesh(pinGeo, pinMat(hex));
    m.position.copy(toVec(g.lat, g.lng, 1.02));
    m.scale.setScalar(1 + Math.min(g.events.length, 6) * 0.25);
    m.userData.dest = g.id;
    pinsGroup.add(m); pinMeshes.push(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.045, 24), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    ring.userData.ring = true;
    ring.position.copy(m.position); ring.lookAt(m.position.clone().multiplyScalar(2)); pinsGroup.add(ring);
  });
}

function pick(e) {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(pinMeshes, false)[0];
  const sphereHit = raycaster.intersectObject(globeMesh, false)[0];
  if (hit && (!sphereHit || hit.distance <= sphereHit.distance + 0.02)) select(hit.object.userData.dest, false); // ignore pins on the far side
}

function select(destId, fromList) {
  selectedDest = selectedDest === destId && fromList ? null : destId;
  const g = byDestination(visibleEvents()).find((x) => x.id === selectedDest);
  if (g && globe) { // turn the globe so the place faces the camera
    const p = toVec(g.lat, g.lng, 1), L = Math.hypot(p.x, p.z);
    targetRot = { y: Math.atan2(-p.x, p.z), x: Math.atan2(p.y, L) };
  } else targetRot = null;
  renderList();
}

// ---------- boot ----------
range.addEventListener('input', () => { selectedDest = null; renderList(); });
winSel.addEventListener('change', () => { selectedDest = null; renderList(); });
spinBtn.addEventListener('click', () => { spinning = !spinning; spinBtn.setAttribute('aria-pressed', String(!spinning)); spinBtn.textContent = spinning ? 'Pause rotation' : 'Resume rotation'; });
if (reduce) { spinBtn.textContent = 'Resume rotation'; spinBtn.setAttribute('aria-pressed', 'true'); }

(async () => {
  try {
    const r = await fetch('/api/globe');
    events = (await r.json()).data || [];
  } catch { statusEl.textContent = 'Could not load events.'; return; }
  if (events.length) {
    const ys = events.map((e) => e.event_year);
    range.min = Math.min(...ys) - 10; range.max = Math.max(nowYear, ...ys);
    range.value = Math.min(Math.max(1947, Number(range.min)), Number(range.max));
  }
  if (hasWebGL()) { try { build(); } catch (e) { console.error(e); canvas.hidden = true; } } else canvas.hidden = true;
  renderList();
})();
