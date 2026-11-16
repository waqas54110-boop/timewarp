import * as THREE from '/vendor/three/three.module.js';

const hero = document.getElementById('hero');
const canvas = document.getElementById('portal');
const toggle = document.getElementById('portal-toggle');

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

if (!canvas || !hasWebGL()) {
  hero?.classList.add('no-webgl');
} else {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = { past: 0xffb347, present: 0x22d3ee, future: 0xa78bfa };
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.z = 9;

  const group = new THREE.Group();
  scene.add(group);
  const rings = [];
  for (let i = 0; i < 14; i++) {
    const geo = new THREE.TorusGeometry(1.2 + i * 0.42, 0.035 + i * 0.002, 12, 120);
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.present, transparent: true, opacity: Math.max(0.15, 0.95 - i * 0.06) });
    const m = new THREE.Mesh(geo, mat);
    m.position.z = -i * 1.1;
    group.add(m);
    rings.push(m);
  }

  const N = 1400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 9;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.sin(a) * r; pos[i * 3 + 2] = -Math.random() * 40 + 10;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: COLORS.present, size: 0.05, transparent: true, opacity: 0.8 });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  let paused = reduce, dirty = true, warp = false, speed = 1, raf = 0;

  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  window.addEventListener('resize', resize);
  resize();

  document.addEventListener('timewarp:mode', (e) => {
    const c = COLORS[e.detail] ?? COLORS.present;
    rings.forEach((r) => r.material.color.setHex(c));
    pMat.color.setHex(c);
    dirty = true;
  });
  document.addEventListener('timewarp:warp', () => { warp = true; paused = false; });

  toggle?.addEventListener('click', () => {
    paused = !paused;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Play animation' : 'Pause animation';
  });
  toggle && (toggle.textContent = paused ? 'Play animation' : 'Pause animation', toggle.setAttribute('aria-pressed', String(paused)));

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    if (!paused) {
      speed += ((warp ? 12 : 1) - speed) * 0.04;
      rings.forEach((r, i) => {
        r.rotation.z += 0.002 * speed * (i % 2 ? 1 : -1);
        r.position.z += 0.012 * speed;
        if (r.position.z > 6) r.position.z -= 14 * 1.1;
      });
      const p = pGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        let z = p.getZ(i) + 0.03 * speed;
        if (z > 10) z = -30;
        p.setZ(i, z);
      }
      p.needsUpdate = true;
      group.rotation.z = Math.sin(t / 4000) * 0.15;
      dirty = true;
    }
    if (dirty) { renderer.render(scene, camera); dirty = false; }
  }
  raf = requestAnimationFrame(frame);

  // Release GPU resources when leaving the page
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(raf);
    rings.forEach((r) => { r.geometry.dispose(); r.material.dispose(); });
    pGeo.dispose(); pMat.dispose(); renderer.dispose();
  });
}
